<div align="center">
  <img src="src/assets/brand/animonkey-logo.svg" alt="Animonkey" width="420" />

  <h1>Animonkey Desktop</h1>

  <p>Descubra animes, organize sua biblioteca pessoal e assista a episódios de fontes disponíveis.</p>

  <p>
    <a href="README.md">English</a> ·
    <a href="https://github.com/DaniHRE/animonkey-electron">Repositório no GitHub</a>
  </p>

  <p>
    <img src="https://img.shields.io/badge/Electron-43.4.0-47848F?logo=electron&logoColor=white" alt="Electron 43.4.0" />
    <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black" alt="React 19" />
    <img src="https://img.shields.io/badge/TypeScript-6.0-3178C6?logo=typescript&logoColor=white" alt="TypeScript 6.0" />
    <img src="https://img.shields.io/badge/pnpm-10.33.3-F69220?logo=pnpm&logoColor=white" alt="pnpm 10.33.3" />
    <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-4CAF50.svg" alt="Licença MIT" /></a>
  </p>
</div>

O Animonkey Desktop reúne descoberta de animes e acompanhamento de uma biblioteca pessoal em um aplicativo desktop. Explore o catálogo e a agenda do AniList, mantenha sua biblioteca neste dispositivo e use o runtime da Anivexa para localizar fontes de episódios compatíveis com o Vidstack.

> **Estado do lançamento:** a versão 1.0 está em preparação. Windows x64 é o primeiro alvo de distribuição; ainda não há instalador público. O suporte a outras plataformas de lançamento não foi confirmado.

## Página inicial

![Página inicial do Animonkey Desktop](docs/screenshots/home.png)

## O que você pode fazer

- **Descobrir animes:** explore títulos da temporada, pesquise com filtros do catálogo, consulte a agenda e veja detalhes com metadados do AniList.
- **Organizar uma biblioteca pessoal:** mantenha localmente sua lista para assistir, avaliações e progresso dos episódios. Esses recursos funcionam sem conta e ficam disponíveis offline.
- **Fazer backup dos dados:** importe e exporte um backup local versionado.
- **Sincronizar se quiser:** entre em uma conta para sincronizar dados compatíveis da biblioteca e usar o feed de atividade.
- **Assistir a episódios disponíveis:** obtenha listas de episódios e providers da Anivexa e reproduza fontes compatíveis com o Vidstack.

A reprodução depende do episódio, do provider e da fonte disponíveis no momento. O aplicativo não hospeda animes nem garante a disponibilidade de uma fonte, faixa de áudio ou legenda específica.

## Tecnologias

- **Desktop e build:** Electron Forge, Vite, React 19 e TypeScript 6
- **Interface:** Tailwind CSS 4, shadcn/Radix, TanStack Router e TanStack Query
- **Reprodução:** Vidstack, HLS.js e dash.js
- **Gerenciador de pacotes:** pnpm 10
- **Catálogo:** AniList; integração de fontes de episódios pelo submódulo fixado da API Anivexa

## Executar a partir do código-fonte

Ainda não há instalador público. Para iniciar o aplicativo em desenvolvimento, instale [Node.js 26.x](https://nodejs.org/) e pnpm 10.33.3 e execute:

```sh
pnpm install
pnpm start
```

Conta e sincronização são opcionais. Esses recursos precisam das configurações da API desktop descritas em [`.env.example`](.env.example). Use no aplicativo somente a chave pública de cliente; nunca adicione segredos de servidor, como uma chave `service_role` do Supabase.

Para criar localmente um pacote Windows x64:

```sh
pnpm make --platform=win32 --arch=x64
```

O pacote prepara o submódulo fixado [`vendor/anivexa-api`](vendor/anivexa-api) como um processo utilitário local do Electron. As consultas de episódios e providers usam IPC tipado entre o renderer e o processo principal.

## Documentação

- [Índice da documentação](docs/README.md)
- [Roadmap do release 1.0](docs/releases/1.0-roadmap.md)
- [Checklist ativo do release 1.0](docs/releases/1.0-checklist.md)
- [Plano de migração arquivado](docs/archive/MIGRATION_PLAN.md)
- [Guia de contribuição](CONTRIBUTING.md)

## Créditos e inspirações

- [AniList](https://anilist.co/) fornece metadados do catálogo e da agenda.
- [Anivexa API](https://github.com/DaniHRE/Anivexa-API) fornece a integração de episódios e providers pelo submódulo fixado neste repositório.
- [Taizen](https://taizen.moe/) pode enriquecer títulos em destaque com artes.
- [Vidstack](https://vidstack.io/) fornece a estrutura do player e as interfaces de legendas.
- A hierarquia de informações da página de watch teve como inspiração o [Re:ANIME](https://reanime.cz/). A interface e o estilo desktop do Animonkey foram implementados de forma independente.

## Licença

Este repositório usa a [Licença MIT](LICENSE). Projetos, artes e APIs de terceiros mantêm suas próprias licenças e termos.
