# Animonkey Desktop

Aplicativo desktop Electron do Animonkey. A passagem funcional para desktop foi encerrada por decisão de produto; o app web em `../animonkey` continua funcional e independente. A preparação da distribuição 1.0 ainda tem decisões e validações próprias. Veja o [plano de migração](./MIGRATION_PLAN.md) e o [tracker de progresso](./MIGRATION_PROGRESS.md).

## Estado atual

O app inclui shell desktop, descoberta do AniList, busca com filtros, detalhes, agenda, cache offline, biblioteca local, backup importável/exportável, conta/sync, feed e o player Vidstack com fontes Anivexa e proxy de mídia no processo principal para HLS/DASH, headers, Range e legendas. Watch Together, painel admin e páginas institucionais permanecem no site web; não fazem parte do escopo desktop atual. A distribuição conjunta da Anivexa e os demais critérios de release 1.0 estão em preparação; veja [MIGRATION_PLAN.md](./MIGRATION_PLAN.md) e [MIGRATION_PROGRESS.md](./MIGRATION_PROGRESS.md).

## Requisitos e comandos

- Node.js 24 (ou versão LTS compatível com o starter) e pnpm 10.
- `pnpm install` instala dependências a partir do `pnpm-lock.yaml`.
- `pnpm start` executa o app em desenvolvimento.
- `pnpm typecheck`, `pnpm lint` e `pnpm format:check` validam o código.
- `pnpm package` empacota o app; `pnpm make` cria os instaladores da plataforma atual.

## API de episódios e player

- Desenvolvimento local usa `http://localhost:4000` como padrão para a API Anivexa.
- Para apontar para outra instância, configure `VITE_ANIVEXA_API_URL` antes de iniciar ou empacotar. Builds de produção aceitam apenas HTTPS.
- HTTP para `localhost` em pacote de QA exige o opt-in `VITE_ALLOW_LOCAL_HTTP_API_FOR_TESTS=true`; não use esse modo em distribuição.
- A API Anivexa fornece episódios e fontes, não um proxy de mídia. O processo principal do Electron faz o proxy local e reescreve playlists HLS e manifests DASH, encaminhando Range e headers exigidos. Nenhuma chave privada da Anivexa deve entrar no app.
- A reprodução depende da Anivexa. A decisão é distribuí-la junto com o Electron; o modelo de empacotamento e execução será fechado na preparação do release 1.0.

## Arquitetura

- `src/main.ts`: janela e ciclo de vida Electron.
- `src/preload.ts`: bridge `window.animonkey` pequena e tipada.
- `src/app.tsx` e `src/components/`: rotas e interface React.
- `src/services/`: integrações desacopladas da UI.
- `src/lib/`, `src/hooks/`, `src/context/`, `src/types/`: domínio compartilhado do renderer.

O renderer não recebe acesso a Node. Segredos de servidor nunca são distribuídos dentro do pacote. Consulte [AGENTS.md](./AGENTS.md) antes de implementar features.
