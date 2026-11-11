import {
  applyRemoteEpisodeProgress,
  applyRemoteEpisodeProgressDeletion,
  applyRemoteWatchLater,
  applyRemoteWatchLaterDeletion,
  getEpisodeProgressSyncData,
  getWatchLaterSyncData,
} from '@/services/cache/local-db';
import type { EpisodeProgressRecord } from '@/services/cache/local-db';

interface Version<T> {
  value: T | null;
  deletedAt: number | null;
  updatedAt: number;
  source: 'local' | 'remote';
}

function chooseVersion<T>(local: Version<T>, remote: Version<T>): Version<T> {
  if (local.updatedAt !== remote.updatedAt) {
    return local.updatedAt > remote.updatedAt ? local : remote;
  }
  if (local.value === null || remote.value === null) {
    return local.value === null ? local : remote;
  }
  return remote;
}

function getTombstoneMap(
  tombstones: { recordKey: string; deletedAt: number }[],
) {
  return new Map(
    tombstones.map((tombstone) => [tombstone.recordKey, tombstone.deletedAt]),
  );
}

function getRecordVersion<T>(
  record: T | undefined,
  deletedAt: number | undefined,
  updatedAt: (value: T) => number,
  source: 'local' | 'remote',
): Version<T> | null {
  if (!record && deletedAt === undefined) return null;
  const recordAt = record ? updatedAt(record) : -1;
  if (deletedAt !== undefined && deletedAt >= recordAt) {
    return { value: null, deletedAt, updatedAt: deletedAt, source };
  }
  if (record) {
    return {
      value: record,
      deletedAt: null,
      updatedAt: recordAt,
      source,
    };
  }
  return null;
}

async function syncWatchLater(): Promise<void> {
  const local = await getWatchLaterSyncData();
  const remote = await window.animonkey.account.listWatchLater();
  const localItems = new Map(local.items.map((item) => [item.animeId, item]));
  const remoteItems = new Map(remote.items.map((item) => [item.animeId, item]));
  const localTombstones = getTombstoneMap(local.tombstones);
  const remoteTombstones = getTombstoneMap(remote.tombstones);
  const keys = new Set([
    ...localItems.keys(),
    ...remoteItems.keys(),
    ...localTombstones.keys(),
    ...remoteTombstones.keys(),
  ]);

  for (const animeId of keys) {
    const localVersion = getRecordVersion(
      localItems.get(animeId),
      localTombstones.get(animeId),
      (item) => item.addedAt,
      'local',
    );
    const remoteVersion = getRecordVersion(
      remoteItems.get(animeId),
      remoteTombstones.get(animeId),
      (item) => item.addedAt,
      'remote',
    );
    if (!localVersion && !remoteVersion) continue;
    if (!localVersion && remoteVersion) {
      if (remoteVersion.value) {
        await applyRemoteWatchLater(remoteVersion.value);
      } else if (remoteVersion.deletedAt !== null) {
        await applyRemoteWatchLaterDeletion(animeId, remoteVersion.deletedAt);
      }
      continue;
    }
    if (!remoteVersion && localVersion) {
      if (localVersion.value) {
        await window.animonkey.account.upsertWatchLater(localVersion.value);
      } else if (localVersion.deletedAt !== null) {
        await window.animonkey.account.removeWatchLater(
          animeId,
          localVersion.deletedAt,
        );
      }
      continue;
    }

    const winner = chooseVersion(localVersion!, remoteVersion!);
    if (winner.source === 'local') {
      if (winner.value) {
        await window.animonkey.account.upsertWatchLater(winner.value);
      } else if (winner.deletedAt !== null) {
        await window.animonkey.account.removeWatchLater(
          animeId,
          winner.deletedAt,
        );
      }
    } else if (winner.value) {
      await applyRemoteWatchLater(winner.value);
    } else if (winner.deletedAt !== null) {
      await applyRemoteWatchLaterDeletion(animeId, winner.deletedAt);
    }
  }
}

async function syncEpisodeProgress(): Promise<void> {
  const local = await getEpisodeProgressSyncData();
  const remote = await window.animonkey.account.listEpisodeProgress();
  const localByAnime = groupProgress(local.records);
  const remoteByAnime = groupProgress(remote.records);
  const localTombstones = getTombstoneMap(local.tombstones);
  const remoteTombstones = getTombstoneMap(remote.tombstones);
  const animeIds = new Set([
    ...localByAnime.keys(),
    ...remoteByAnime.keys(),
    ...localTombstones.keys(),
    ...remoteTombstones.keys(),
  ]);

  for (const animeId of animeIds) {
    const deletionTime = Math.max(
      localTombstones.get(animeId) ?? 0,
      remoteTombstones.get(animeId) ?? 0,
    );
    const localRecords = (localByAnime.get(animeId) ?? []).filter(
      (record) => record.updatedAt > deletionTime,
    );
    const remoteRecords = (remoteByAnime.get(animeId) ?? []).filter(
      (record) => record.updatedAt > deletionTime,
    );

    if (deletionTime > 0) {
      await applyRemoteEpisodeProgressDeletion(animeId, deletionTime);
      await window.animonkey.account.removeEpisodeProgressForAnime(
        animeId,
        deletionTime,
      );
    }

    const localByEpisode = new Map(
      localRecords.map((record) => [record.key, record]),
    );
    const remoteByEpisode = new Map(
      remoteRecords.map((record) => [record.key, record]),
    );
    const keys = new Set([...localByEpisode.keys(), ...remoteByEpisode.keys()]);
    for (const key of keys) {
      const localRecord = localByEpisode.get(key);
      const remoteRecord = remoteByEpisode.get(key);
      if (!localRecord && remoteRecord) {
        await applyRemoteEpisodeProgress(remoteRecord);
      } else if (localRecord && !remoteRecord) {
        await window.animonkey.account.upsertEpisodeProgress(localRecord);
      } else if (localRecord && remoteRecord) {
        if (localRecord.updatedAt > remoteRecord.updatedAt) {
          await window.animonkey.account.upsertEpisodeProgress(localRecord);
        } else if (remoteRecord.updatedAt >= localRecord.updatedAt) {
          await applyRemoteEpisodeProgress(remoteRecord);
        }
      }
    }
  }
}

function groupProgress(
  records: EpisodeProgressRecord[],
): Map<string, EpisodeProgressRecord[]> {
  const grouped = new Map<string, EpisodeProgressRecord[]>();
  for (const record of records) {
    const list = grouped.get(record.animeId) ?? [];
    list.push(record);
    grouped.set(record.animeId, list);
  }
  return grouped;
}

export async function reconcileAccountData(): Promise<void> {
  await syncWatchLater();
  await syncEpisodeProgress();
  window.dispatchEvent(new Event('animonkey:account-sync-applied'));
}
