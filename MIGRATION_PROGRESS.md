# Progresso da migração

Este tracker acompanha [MIGRATION_PLAN.md](./MIGRATION_PLAN.md). Estado atualizado em 11/11/2026.

| Fase                              | Estado        | Evidência / próximo passo                                                                                                                                                                                         |
| --------------------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0 — Repositório e baseline        | `COMPLETED`   | `main` acompanha `origin/main` (`DaniHRE/animonkey-electron`); `AGENTS.md`, scripts, identidade do app e baseline de validação configurados. Sem commits/push nesta migração.                                     |
| 1 — Fundação UI e compatibilidade | `IN_PROGRESS` | HashRouter, shell desktop, alias, Tailwind 4, primitiva shadcn, error boundary global, skip link e CSP derivada da URL pública. Faltam outras primitivas e QA de acessibilidade.                                  |
| 2 — Domínio e dados públicos      | `IN_PROGRESS` | Home, busca AniList paginada com ANIME/adult e filtros, detalhes enriquecidos, catálogo e agenda; cache IndexedDB com TTL e fallback expirado. Falta revisar paridade completa e otimizar o cache.                |
| 3 — Player e streaming            | `COMPLETED`   | Vidstack é o player único; engine, resolver, controller, Zustand, captions e fallback foram validados no smoke do pacote confirmado pelo usuário em 11/11/2026. `TD-PLAYER-001` permanece adiado.                 |
| 4 — Persistência offline          | `COMPLETED`   | Usuário confirmou importação válida/mesclagem, rejeição do backup inválido e retenção após upgrade do IndexedDB v3→v4. Cache vencido é limpo após 30 dias de fallback; gravação de cache é opcional para AniList. |
| 5 — Conta e sync                  | `NOT_STARTED` | Auditoria da referência web encontrou senha armazenada/comparada sem hash apesar da documentação dizer bcrypt; não portar. Primeiro corrigir autenticação no servidor e decidir API HTTPS segura para desktop.    |
| 6 — Watch Together e complementos | `NOT_STARTED` | Adiado por decisão do usuário; não iniciar nesta etapa da migração.                                                                                                                                               |
| 7 — Distribuição                  | `IN_PROGRESS` | `pnpm package` produziu pacote Windows x64. Sem instalador/release, assinatura, atualização ou QA de outras plataformas.                                                                                          |

## Trilha de modernização de player e arquitetura

| Item                                     | Estado        | Evidência / próximo passo                                                                                                                                                                                 |
| ---------------------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Decisão do player principal              | `COMPLETED`   | Em 10/11/2026 o usuário aprovou Vidstack como player único e a remoção de Plyr como backup antes do smoke final. Sem engine alternativo; fallback atua apenas sobre fontes/provedores dentro do Vidstack. |
| Verificação de versões e compatibilidade | `COMPLETED`   | Vidstack 1.15.7, React 19, Vite 5 e Electron 43: typecheck, lint, formatação, package Windows x64 e smoke audiovisual do pacote confirmados pelo usuário.                                                 |
| Vidstack como engine único               | `COMPLETED`   | `VideoPlayer` carrega só Vidstack; Plyr e código exclusivo foram removidos. Reprodução e captions no pacote confirmadas pelo usuário. `TD-PLAYER-001` segue adiado.                                       |
| Source Resolver                          | `COMPLETED`   | `resolvePlaybackSource` cobre proxy/direto/embed permitido e MIME HLS/DASH/MP4; usuário confirmou o player funcional no pacote.                                                                           |
| Playback Controller                      | `COMPLETED`   | Fallback, troca de servidor e cleanup pelo `usePlaybackController` foram confirmados pelo usuário no smoke do pacote.                                                                                     |
| Zustand                                  | `COMPLETED`   | Seleção `{ episodeId, serverId }` compartilhada entre seletor manual e fallback; a troca foi confirmada no smoke do pacote. Fontes e credenciais não ficam no store.                                      |
| IPC tipado                               | `NOT_STARTED` | Preload atualmente expõe somente `platform` e não há handlers IPC. Levantar necessidade de capacidades privilegiadas antes de acrescentar canais; manter a bridge mínima quando não houver caso concreto. |
| Service Manager                          | `NOT_STARTED` | Não há processos externos supervisionados identificados. Implementar somente se surgir requisito real de iniciar/monitorar serviço ou processo local.                                                     |
| Smoke audiovisual empacotado             | `COMPLETED`   | Usuário confirmou em 11/11/2026 que o player está correto no pacote. `TD-PLAYER-001` permanece registrado e adiado.                                                                                       |

## Entregue até aqui

- Configuração local de Git/arquitetura e comandos, preservando o repo web.
- Janela Electron isolada: context isolation, sandbox, Node desativado no renderer, CSP, bloqueio de navegação e abertura externa limitada.
- Shell desktop, React Router, configuração inicial do shadcn e componente Button.
- Serviço AniList com timeout, abort, erros tipados e o mesmo contrato ANIME/adult da busca web.
- Home (trending, lançamentos, recentes, concluídos e agenda), busca com paginação/filtros persistidos na URL, coleções e detalhes com personagens, relações, recomendações, trailer YouTube e próxima estreia.
- Player Vidstack Anivexa com episódios por provedor, troca de servidor, Source Resolver/Playback Controller, proxy local, HLS/DASH, captions nativas, skip de intro/outro e retomada de posição. JASSUB fica fora da build atual.
- IndexedDB schema v3: Assistir Depois, cache AniList, progresso, preferências; Continue Watching e backup JSON com validação e importação mesclável.

## Validação

- `pnpm typecheck` — aprovado.
- `pnpm lint` — aprovado sem avisos.
- `pnpm format:check` — aprovado.
- `git diff --check` — aprovado.
- `pnpm package` — aprovado para Windows x64 após fechar o processo que bloqueava a DLL do pacote; bundler reporta avisos `use client` de dependências React, sem falha.
- Smoke visual: home, imagens AniList e rotas foram exibidas; o item salvo em Assistir Depois permaneceu após reiniciar o app.
- Smoke do pacote atualizado: tela inicial/catalogo AniList e Configurações locais renderizaram; exportação de backup mostrou confirmação. O diálogo foi cancelado para não sobrescrever um arquivo de mesmo nome na pasta Downloads.
- Smoke do player: erro de renderização observado em episódio real foi contido dentro do quadro 16:9; título, controles anterior/próximo, metadados e lista de episódios permaneceram visíveis e selecionáveis.
- API local: `GET /map/16498` e `GET /episodes/16498` responderam 200; conferido o formato real de IDs por provedor e o especial episódio 0 sem expor URLs de streaming.
- Histórico: o pacote usava worker ES para Vite/JASSUB com o engine Plyr; worker e dependência foram removidos no corte para Vidstack único.
- 08/11/2026: `pnpm typecheck`, `pnpm lint`, `pnpm format:check` e `git diff --check` passaram após sanitizar mensagens de erro no catálogo/episódios. O detalhe técnico permanece como `cause` interno e não é renderizado na UI.
- Smoke em desenvolvimento em 08/11/2026: catálogo/home, detalhes de anime e configurações locais renderizaram no Electron. A automação da janela não chegou à reprodução nesta execução; o estado audiovisual continua pendente.
- 10/11/2026: `pnpm typecheck`, `pnpm lint`, Prettier, `git diff --check` e `pnpm package` Windows x64 passaram após correções de provider, iframe e sincronização do ciclo mount das engines. Bundle avisou apenas sobre diretivas `use client` de dependências. Não foi feito smoke de UI/player; por regra de controle do computador, reprodução e estados audiovisuais reais permanecem por confirmar.

## Próximos passos

1. Manter conta/sync sem implementação até corrigir a autenticação de senha no servidor web e validar o fluxo seguro.
2. Definir a fronteira HTTPS do login desktop, sessão, ownership e armazenamento de tokens antes de criar UI ou código de sync.
3. Depois da decisão de backend, migrar as fatias de conta/sync compatíveis com o funcionamento offline e sem segredos privados no cliente.
4. Confirmar endpoint HTTPS Anivexa para release e avaliar IPC tipado somente se surgir capacidade privilegiada concreta.
5. Watch Together e complementos ficam adiados (`NOT_STARTED`); seguir para distribuição conforme inventário.

## Commits por etapa

- `b49d82e feat: migrate catalog and player workflows to Electron` — base de catálogo/player e erros voltados ao usuário; `pnpm typecheck`, `pnpm lint`, `pnpm format:check` e `git diff --check` aprovados.
- `e091ae9 docs: record migration smoke status` — smoke em desenvolvimento documentado; catálogo, detalhes e configurações locais renderizaram. A reprodução audiovisual ficou sem confirmação.
- `6f65a62 docs: require approval for computer control` — regra explícita para não usar controle visual sem solicitação e aprovação do usuário.
- Fallback HLS alinhado à versão browser com guarda de playlistKey. API Anivexa local listou fontes HLS; manifesto Reanime respondeu 200 e, após XOR com a chave real, decodificou para `#EXTM3U` com quatro variantes. Sem Referer, o segmento dava 403; com `https://flixcloud.cc/` inferido do embed, master, variante e segmento retornaram 200 (segmento de 3,8 MB). Próximo: validar playback de áudio/vídeo e legendas no app empacotado.
- Verificação da etapa: o segmento válido vinha de CDN em `stellarcdn.top`, mas a transformação estava limitada a `atomic4cdn.top`. A regra foi ampliada para hosts variáveis e agora exige sync MPEG-TS nos offsets 0/188/376 após remoção de cabeçalho/XOR. Ainda falta observar reprodução real no aplicativo.
- Evidência do erro atual: logs reportam 502 em segmentos `.png`/`.webp`, CSP bloqueando imagem no esquema `animonkey-media:`, falha de origem no `<track>` VTT e `TypeError` do Plyr ao selecionar índice sem faixa. Requisição técnica ao segmento retornou 200 `image/png`, mas sem assinatura PNG; o proxy consumia o stream ao tentar decodificar e depois encaminhava o corpo já consumido, convertendo o erro em 502. Corrigido o passthrough usando os bytes já lidos. Também alinhados unwrapping, CSP, VTT em blob e seleção Plyr. Typecheck/lint/formatação e pacote passam; ainda falta validar áudio/vídeo no app.
- Etapa de UX: removidos dropdown externo de legenda e botões flutuantes de tamanho. Tracks WebVTT e auxiliares ASS/SSA aparecem no menu de captions do Plyr; o ajuste de tamanho foi integrado a Configurações. WebVTT segue o CSS responsivo Plyr; ASS/SSA refaz o conteúdo com escala sobre `Fontsize` dos estilos e tags `\\fs` inline, sempre partindo do original. Typecheck/lint passam; falta validar a interação em runtime.

- 10/11/2026 — decisão arquitetural aprovada: Vidstack será o player principal, principalmente pela biblioteca de captions com suporte documentado a VTT, SRT, SSA/ASS e JSON, além de plugin JASSUB opcional. Apenas documentação foi atualizada nesta etapa; nenhum código, dependência ou lockfile mudou. A manutenção do Vidstack é somente de segurança até janeiro de 2028 segundo a documentação oficial, risco aceito com encapsulamento e revisão de suporte planejados. A implementação, compatibilidade de versão e smoke audiovisual permanecem pendentes.
- 10/11/2026 — diagnóstico documental da arquitetura desktop: preload expõe somente `platform`; não foram encontrados handlers IPC, Zustand, Playback Controller, Source Resolver, Service Manager ou testes automatizados. O player existente continua sendo Plyr 3.8.5 com HLS.js, dash.js e JASSUB. A build Windows x64 tem evidência anterior, mas não prova reprodução real.

- 10/11/2026 — piloto Vidstack iniciado: adicionados `@vidstack/react` 1.15.7, componente opt-in, estilos e chave de build `VITE_PLAYER_ENGINE=vidstack`; Plyr continua padrão. O piloto usa os proxies/fontes atuais, HLS/dash.js, tracks VTT/SRT/ASS/SSA/JSON, chapters, progresso, retomada e menu de captions/tamanho. Ainda sem integração JASSUB e sem source smoke audiovisual. `pnpm install --frozen-lockfile --ignore-scripts`, `pnpm typecheck`, `pnpm lint`, Prettier e `pnpm package` Windows x64 com `VITE_PLAYER_ENGINE=vidstack` passaram; o bundle inclui avisos de diretiva `use client` em módulos Vidstack/dependências, sem falha de build. Não se executou smoke de UI/player nesta sessão. Para iniciar o piloto no PowerShell, definir `$env:VITE_PLAYER_ENGINE='vidstack'` antes de `pnpm start` ou `pnpm package`.
- Desvio registrado: para tornar o engine exercitável em fontes reais, foi implementado primeiro um adaptador opt-in antes da extração formal de Playback Controller/Source Resolver. O piloto ficou isolado; esses contratos seguem como próximos passos antes de ampliar o cutover.
- Commit de implementação do piloto: `3514d7b feat: add opt-in Vidstack player pilot`.
- 10/11/2026 — usuário confirmou que o teste de integração Vidstack está funcionando e ASS/SRT/VTT renderizam; problema observado no seletor de tamanho. Removida a escala customizada paralela do piloto e adotado o controle nativo **Acessibilidade → Estilos de legenda → Fonte → Tamanho** (`--media-user-font-size`). O preset foi alinhado ao Plyr e depois confirmado como satisfatório pelo usuário; smoke do pacote Windows continua sem registro.
- 10/11/2026 — refinamento pedido: sombra das captions Vidstack suavizada para o preset mais próximo do CSS antigo Plyr; default seleciona somente legenda PT-BR e nunca English. Selector agora separa provedores (Reanime, Animedunia etc.) dos subservidores e ordena fontes PT-BR antes das English. Validar visualmente o preset e o seletor no runtime.
- 10/11/2026 — registrado débito `TD-PLAYER-001`: captions ocasionais mostram quebras e texto/comandos fora de contexto; captura e critérios de investigação em `docs/technical-debt/README.md`. Correção foi explicitamente adiada pelo usuário.
- 10/11/2026 — próximo passo iniciado: `src/lib/player-source-resolver.ts` unifica a resolução proxy/direta/embed permitido e MIME entre os engines sem mover credenciais para fora do proxy. Typecheck/lint/formatação aprovados. Extração do Playback Controller continua pendente; sem smoke UI nesta etapa.
- 10/11/2026 — Playback Controller iniciado em `src/hooks/use-playback-controller.ts` e integrado a Plyr/Vidstack: dedupe de falha, fallback HLS direto apenas sem `playlistKey`, avanço para próximo servidor, embed HTTPS permitido, erro terminal, retry e reset após recuperação. Typecheck, lint, formatação e `git diff --check` passaram; sem smoke UI/audio nesta etapa.
- `pnpm package` Windows x64 com `VITE_PLAYER_ENGINE=vidstack` passou após integrar resolver e controller; bundler mostrou avisos de diretivas `use client` em Vidstack/dependências, sem falha.
- Commit local desta fatia: `be3a8f0 feat: centralize player playback control`.
- 10/11/2026 — corte para Vidstack único aprovado: removidos Plyr/plyr-react, JASSUB legado, CSS/ícone, wrapper/fallback por engine e controles antigos de tamanho em Configurações. Removidos `use-subtitle-size` e tipos de escala; Configurações aponta para o menu nativo Vidstack. `pnpm remove` atualizou lockfile. `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `git diff --check` e `pnpm package` Windows x64 sem flag de engine passaram. Bundler manteve apenas avisos `use client` de Vidstack/dependências. Smoke audiovisual ainda pendente.
- Commit local do corte: `72ffccb feat: make Vidstack the sole player`.
- 10/11/2026 — Zustand iniciado para estado compartilhado concreto: `playback-session-store` guarda somente a seleção de servidor vinculada ao episódio; tanto a seleção manual quanto a troca automática do `usePlaybackController` leem/escrevem essa seleção. A URL permanece autoridade do episódio, e listas/fontes/headers continuam fora do store. Adicionada dependência `zustand` 5.0.16. `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `git diff --check` e `pnpm package` Windows x64 passaram; smoke audiovisual empacotado segue pendente.

- 11/11/2026 — usuário confirmou que o player está correto após verificar o pacote. Fase 3 concluída; TD-PLAYER-001 permanece deliberadamente adiado. Inspeção da próxima fase mostrou que importação transacional/mesclável de backup e atualização dos contextos após import já estão implementadas; ainda falta evidência de uso empacotado e retenção após upgrade.

- 11/11/2026 — hardening da fase 4: a importação valida o timestamp de exportação, os campos opcionais da biblioteca e o objeto de título antes de iniciar a transação; backups inválidos não gravam dados. Typecheck, lint, formatação, diff check e package Windows x64 passaram. Smoke de importação e retenção do IndexedDB segue pendente.
- 11/11/2026 — usuário confirmou que o backup JSON inválido foi rejeitado corretamente. Isso valida a rota de erro sem confirmar a mesclagem de um backup válido nem retenção após upgrade; esses itens permanecem no próximo passo.
- 11/11/2026 — usuário confirmou importação de backup válido, mesclagem e retenção após reinício/upgrade. Resta revisar limites de quota, cache expirado e recuperação de falha local antes de fechar a fase 4.
- 11/11/2026 — catálogo offline: cache vencido permanecia sem limite. IndexedDB agora sobe do schema v3 para v4, cria índice `expiresAt` mesmo no store existente e elimina durante gravações os registros vencidos há mais de 30 dias, preservando o fallback recente. Typecheck, lint, formato e package Windows x64 passam; testar upgrade v3→v4 com dados reais antes de concluir a fase.
- Commit local do hardening de backup: `0e9603e fix: validate imported local backup records`.
- Commit local que registrou o smoke do player: `10217bc docs: mark player validation complete`.

- 11/11/2026 — usuário confirmou os testes da fase offline: importação válida/mesclagem, rejeição do backup inválido e retenção após upgrade do IndexedDB v3→v4. Fase 4 concluída. Cache mantém fallback recente; erros ao gravar cache não bloqueiam catálogo. Próxima fase: decidir backend remoto de conta/sync. Commit local da implementação de expiração: `565f411 feat: prune stale catalog cache after schema upgrade`.

- 11/11/2026 — usuário confirmou testes da fase offline, inclusive importação/mesclagem e retenção após upgrade v3→v4; fase 4 concluída. Commit da migração e limpeza do cache: `565f411 feat: prune stale catalog cache after schema upgrade`; registro de conclusão: `1bbb0be docs: complete offline persistence milestone`.
- 11/11/2026 — auditoria read-only do repositório web: branch main, working tree limpo, remote DaniHRE/animonkey. O código de Credentials grava a senha crua como password_hash no endpoint de registro e compara em texto puro no authorize; a documentação cita bcrypt-ts, mas o código atual não o usa. Não houve alteração no repositório web. Conta/sync permanece NOT_STARTED até haver autenticação segura e um fluxo HTTPS compatível com desktop.
