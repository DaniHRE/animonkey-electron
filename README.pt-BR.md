# Animonkey Desktop

<p align="center">
  <a href="README.md">English</a> ·
  <a href="https://github.com/DaniHRE/animonkey-electron">Repositório no GitHub</a>
</p>

<table align="center" bgcolor="#0b0b0c">
  <tr><td align="center"><img src="src/assets/brand/animonkey-logo.svg" alt="Animonkey" width="560" /></td></tr>
</table>

<p align="center">
  <img src="https://img.shields.io/badge/Electron-43.4.0-47848F?logo=electron&logoColor=white" alt="Electron 43.4.0" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-6.0-3178C6?logo=typescript&logoColor=white" alt="TypeScript 6.0" />
  <img src="https://img.shields.io/badge/pnpm-10.33.3-F69220?logo=pnpm&logoColor=white" alt="pnpm 10.33.3" />
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-4CAF50.svg" alt="Licença MIT" /></a>
</p>

O Animonkey Desktop é um aplicativo desktop de descoberta de animes e biblioteca pessoal, com foco em funcionamento offline. Ele usa dados de catálogo do AniList e inclui o runtime de episódios da Anivexa para listar providers e fontes de reprodução.

> **Estado do lançamento:** a versão 1.0 ainda está em preparação. Windows x64 é o primeiro alvo de distribuição; ainda não há instalador público. O suporte de lançamento a outros sistemas operacionais não foi confirmado.

## Recursos

- Explore animes da temporada, pesquise com filtros, consulte a agenda e veja detalhes com dados do AniList.
- Mantenha lista para assistir, avaliações e progresso de episódios localmente, sem precisar de conta.
- Importe e exporte um backup local versionado.
- Opcionalmente, entre em uma conta para sincronizar dados compatíveis da biblioteca e usar o feed de atividade.
- Reproduza fontes disponíveis da Anivexa com Vidstack, incluindo streams HLS/DASH e legendas selecionáveis quando fornecidas pelo provider.

A disponibilidade de providers, episódios, áudios e legendas varia conforme a fonte e pode mudar com o tempo.

## Capturas de tela

As capturas da build empacotada serão adicionadas aqui após concluir a captura em um perfil limpo e sem sessão de conta.

## Tecnologias

- Electron Forge e Vite
- React 19 e TypeScript 6
- Tailwind CSS 4
- TanStack Router e TanStack Query
- Vidstack, HLS.js e dash.js
- pnpm 10

## Instalar e executar a partir do código-fonte

Ainda não há instalador público. Para executar a versão de desenvolvimento, instale Node.js 26.x e pnpm 10.33.3 e rode:

```sh
pnpm install
pnpm start
```

Os recursos opcionais de conta e sincronização precisam da configuração da API desktop mostrada em [`.env.example`](.env.example). Use somente a chave pública de cliente; segredos de servidor, como `service_role` do Supabase, nunca devem ser adicionados ao app desktop.

Para criar localmente um pacote Windows x64:

```sh
pnpm make --platform=win32 --arch=x64
```

O pacote prepara o submódulo fixado [`vendor/anivexa-api`](vendor/anivexa-api) como um processo utilitário local. O renderer usa IPC tipado do Electron para consultar episódios e providers; ele não se conecta a um listener HTTP local arbitrário.

## Documentação do projeto

- [Índice da documentação](docs/README.md)
- [Roadmap do release 1.0](docs/releases/1.0-roadmap.md)
- [Checklist ativo do release 1.0](docs/releases/1.0-checklist.md)
- [Plano de migração arquivado](docs/archive/MIGRATION_PLAN.md)
- [Guia de contribuição](CONTRIBUTING.md)

## Créditos e inspirações

- [AniList](https://anilist.co/) fornece os dados do catálogo de animes e da agenda.
- [Anivexa API](https://github.com/DaniHRE/Anivexa-API) fornece a integração de episódios e providers pelo submódulo fixado neste repositório.
- [Taizen](https://taizen.moe/) fornece enriquecimento opcional de artes para títulos em destaque.
- [Vidstack](https://vidstack.io/) fornece a estrutura do player e as interfaces de legendas.
- A hierarquia de informações da página de watch teve como inspiração o [Re:ANIME](https://reanime.cz/); o layout desktop e o estilo do Animonkey foram implementados de forma independente.

Este repositório usa a [Licença MIT](LICENSE). Projetos, artes e APIs de terceiros mantêm suas próprias licenças e termos.
