# Plano de migração — Animonkey para Electron

> **Estado auditado em 18/11/2026:** a passagem funcional do site para o aplicativo Electron está **concluída por decisão de produto**. Este plano fica encerrado como plano de migração. As verificações e decisões ainda necessárias estão classificadas abaixo como preparação do release 1.0, decisão futura ou escopo web/desktop adiado; elas não reabrem a migração.

As classificações usadas nesta auditoria são: **migração concluída e comprovada**, **validação ainda necessária** (sempre com critério), **trabalho de preparação do release 1.0**, **decisão de produto ainda necessária** e **fora do escopo desktop, adiado ou cancelado**. O inventário histórico detalhado, com evidência no código/documentação e próxima ação, está em [MIGRATION_PROGRESS.md](./MIGRATION_PROGRESS.md); a fila ativa de release está em [1.0-checklist.md](../releases/1.0-checklist.md).

## Objetivo e princípio de segurança

Registrar o encerramento da passagem funcional do domínio Animonkey para a aplicação desktop Electron, mantendo o repositório web como produto independente. Este documento conserva o escopo, decisões e evidências históricas da migração e separa o trabalho de preparação do release 1.0.

O repositório web continua sendo uma aplicação independente; concluir a migração não autoriza desligá-lo nem alterá-lo. A decisão atual é considerar concluída a passagem funcional para desktop. A aceitação de release, a cobertura audiovisual de formatos/provedores e as decisões de distribuição têm critérios próprios e não mantêm a migração aberta.

## Estado observado

- Estado atual: Electron Forge/Vite, React 19, TypeScript estrito, Tailwind 4, TanStack Router com hash history e TanStack Query. A navegação e as áreas de catálogo, busca, anime, player, biblioteca, configurações, conta e feed estão no renderer; os detalhes e limites estão no inventário abaixo e no tracker.
- Conta desktop e sync usam a Edge Function Supabase `desktop-api`, chamadas HTTPS do processo main, bridge IPC de domínio e armazenamento de refresh token via `safeStorage`. Os smoke remotos e as confirmações do usuário estão registrados no tracker. O site Next permanece independente.
- Vidstack é o único player. Anivexa fornece o índice e os providers; o fork `DaniHRE/Anivexa-API` está fixado no submódulo `vendor/anivexa-api` em `fb337ea` (SHA confirmado após fetch em 18/11/2026), e o app inicia seu handler em um `utilityProcess`, com IPC tipado. No pacote Windows x64, o smoke CLI validou handler/binding; o smoke de UI de 18/11 carregou `/episodes/21`, `/watch/21` e reproduziu uma fonte AnimeDunya até 2:34, com captions PT-BR visíveis. Cobertura de outros providers, formatos e estados continua na preparação do release 1.0.
- Taizen fornece o ClearLogo inglês e `Media.art` para o fundo do hero; AniList continua como fonte dos demais metadados e fallback do fundo.
- O baseline de 10/11/2026, a substituição de React Router por TanStack Router, a remoção de Plyr e demais decisões/evidências antigas abaixo são registros históricos, não tarefas abertas por si só. O estado Git usado nesta auditoria foi `main`, working tree limpo, `HEAD` `ca4a8e5`, um commit à frente de `origin/main`.
- A decisão de produto registrada em 10/11/2026 é usar **Vidstack como player principal**. O principal benefício esperado é sua biblioteca de captions, que documenta VTT, SRT, SSA/ASS e JSON, além de integração opcional com libass via JASSUB. Essa capacidade é da biblioteca de captions/renderização do Vidstack, não implica que todos os providers ou captions embutidos sejam automaticamente selecionáveis; a compatibilidade de cada fonte continua sujeita a validação.
- Risco de ciclo de vida: a documentação oficial do Vidstack declara manutenção somente de segurança para a linha 1.x, com patches prioritários até janeiro de 2028, e que o desenvolvimento futuro ocorre em Video.js 10. A escolha de Vidstack permanece aprovada para este projeto, mas a dependência deve ficar encapsulada atrás de adapters e o plano deve rever suporte/manutenção antes dessa data e em cada release principal. Se o suporte necessário não puder ser mantido, avaliar migração de implementação sem alterar contratos de domínio.

## Arquitetura alvo

```text
React renderer (UI, TanStack Router/hash, TanStack Query, shadcn, Tailwind)
  ├─ features / hooks / contexts / services de domínio compartilháveis
  ├─ Vidstack (player e captions; integração JASSUB somente onde necessária)
  ├─ Playback Controller (contrato de comandos/eventos independente do player)
  ├─ Source Resolver (normalização de formato, MIME e metadados de fonte)
  ├─ Zustand (estado compartilhado; engine continua autoridade sobre estado de mídia ao vivo)
  ├─ adaptadores de armazenamento local (IndexedDB; migração versionada)
  ├─ APIs públicas permitidas (ex.: AniList, se CORS e CSP permitirem)
       └─ bridge tipada e mínima via window.animonkey (preload), somente para
            capacidades privilegiadas realmente necessárias
            └─ IPC validado por canal, origem e payload
                 └─ Electron main (janelas, ciclo de vida, protocolo de mídia,
                     operações privilegiadas e ciclo de vida do processo local)
                      └─ utilityProcess Anivexa (handler e providers do submódulo)

APIs remotas confiáveis (AniList, Taizen, Supabase protegido, PartyKit)
  └─ chamadas HTTPS; segredos de servidor permanecem fora do aplicativo distribuído
Anivexa distribuída com o app
  └─ código fixado por submódulo; runtime copiado para resources e iniciado localmente
```

Regras da fronteira Electron:

- Renderer sem Node.js, sem acesso direto ao filesystem e sem segredos privados. Manter `contextIsolation: true`, `nodeIntegration: false`, sandbox quando compatível, CSP restritiva e validação de origem/payload nos handlers IPC.
- Preload expõe métodos específicos e tipados, nunca `ipcRenderer`, `require` ou uma ponte genérica.
- Processo main é a fronteira para capacidades locais privilegiadas. Manter providers Anivexa no `utilityProcess`, não no main; não embutir `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `NEXTAUTH_SECRET`, `PARTY_ADMIN_TOKEN` ou credenciais privadas no app.
- Manter `vendor/anivexa-api` como submódulo fixado a um commit do fork. Atualizar a API em seu repositório e, depois, atualizar o gitlink do Electron; não copiar arquivos nem incluir `.env`/`.git` no runtime empacotado.
- A bridge Anivexa usa operações de domínio tipadas e o main valida payload/origem; não abrir servidor loopback nem expor rota IPC genérica. Forge prepara o runtime de produção fora do ASAR e o Electron encerra o processo utilitário ao sair.
- Configuração pública de endpoint pode ser distribuída; qualquer token de usuário deve ser tratado como credencial e armazenado em mecanismo de sistema operacional apropriado, com plano de logout/revogação. O renderer recebe somente o mínimo necessário.
- Serviços de domínio devem depender de interfaces/adaptadores, não de `next/*`, `NextRequest`, `NextResponse` ou APIs específicas do browser sem fallback.

## Inventário de funcionalidades e destino

| Área do app web        | Funcionalidades a preservar                                                               | Destino / observação                                                                                                                                                                                                                                                                                           |
| ---------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shell e navegação      | home, layouts, navbar, tema, transições, not-found e erros                                | **Migração concluída.** Renderer TanStack Router com hash history; mantém URLs `#/...`, voltar/avançar, `ep` e deep links numéricos. Smoke atual de release listado abaixo.                                                                                                                                    |
| Catálogo               | home, trending, updates, detalhes, recomendações, personagens e metadados                 | **Migração concluída.** AniList e Anivexa seguem como serviços de domínio; TanStack Query compartilha queries públicas e cache IndexedDB mantém fallback offline. Taizen fornece ClearLogo inglês/`Media.art`, com AniList como fallback do fundo.                                                             |
| Busca                  | busca de anime, filtros, debounce e histórico                                             | **Migração concluída.** Busca AniList mantém `mediaType: ANIME`, filtros públicos, paginação e critérios na URL. QA de release está na fila 1.0; filtros pessoais sem OAuth continuam fora do produto.                                                                                                         |
| Agenda                 | schedule e cache                                                                          | **Migração concluída.** Serviço e cache integrados ao catálogo; revisão de estados visuais de release fica na fila 1.0.                                                                                                                                                                                        |
| Player                 | episódios, seleção de server/source, HLS, DASH, proxy, progresso, captions e preferências | **Migração funcional concluída; Vidstack é o único player.** Source Resolver, Playback Controller e proxy preservam os contratos de fonte. Cobertura audiovisual de formatos/fontes, captions, capítulos e thumbnails continua como validação de release 1.0, não como engine alternativa ou fase de migração. |
| Dados locais           | watch-later, continue-watching, histórico/cache e preferências                            | **Migração concluída.** IndexedDB versionado por perfil, backups locais e upgrades estão implementados e têm smoke/aceite históricos. A importação direta do IndexedDB do site não existe e depende de decisão específica de release.                                                                          |
| Conta e sync           | cadastro/login/logout, perfil/senha/avatar, ratings, privacidade, export, feed e sync     | **Migração concluída e comprovada.** O desktop usa `desktop-api` por HTTPS; credenciais e refresh token permanecem no processo main/`safeStorage`; sync offline-first, conta e feed têm evidências no tracker. O web continua independente.                                                                    |
| Watch together         | salas, chat, presença, sync de player e admin de sala                                     | **Fora do escopo desktop, adiado.** PartyKit e a experiência correspondente permanecem no produto web; nenhum serviço/credencial admin é incluído no Electron. Reabrir apenas com nova priorização explícita.                                                                                                  |
| Admin                  | dashboard, health, rooms                                                                  | **Fora do escopo desktop, adiado.** Não há rotas admin no Electron; autorização administrativa continua no servidor/site. Revisitar somente com decisão futura de produto.                                                                                                                                     |
| Páginas institucionais | DMCA e termos                                                                             | **Fora do escopo desktop, adiado.** O site web independente continua sendo o destino atual; criar telas desktop requer priorização futura.                                                                                                                                                                     |
| Recursos web           | sitemap, robots, metadata/SEO, Analytics e Speed Insights                                 | **Fora do escopo desktop.** Crawlers/SEO continuam no site. Telemetria própria do desktop só entra mediante decisão e configuração de release apropriadas.                                                                                                                                                     |

## Estratégia recomendada

1. **Dois produtos, um domínio:** o site web continua atendendo web/SEO, independente. O cliente Electron é outra interface do domínio e usa serviços próprios aprovados para operações desktop; conclusão da migração não exige desligar ou alterar o site.
2. **Extração gradual:** primeiro identificar e isolar lógica pura e contratos compartilháveis; depois avaliar uma biblioteca de domínio comum. Não mover arquivos entre repositórios em massa e não criar dependência do app web sobre Electron.
3. **Compatibilidade por adaptador:** renderer chama interfaces de serviços; adaptadores Electron/web encapsulam persistência, autenticação, navegação e capacidades nativas.
4. **Migração por fatia vertical:** cada fase entregou fluxos verificáveis; a passagem funcional está encerrada. Recursos de alto risco mantêm critérios de regressão para o release, não uma fase de migração aberta.
5. **Site estável:** sem mudança de comportamento ou dependência do site para compilar o desktop. Mudanças no backend/site só quando necessárias e em commits/PRs próprios, retrocompatíveis e acompanhados de validação web.

## Fases e critérios de saída

Os títulos de fase abaixo mostram a situação auditada. Os critérios e passos técnicos detalhados preservam o escopo original e as decisões da época; itens residuais foram transferidos para o checklist ativo do release 1.0 ou classificados fora do desktop.

### Resumo histórico de critérios para o release 1.0 (a validação ativa está no checklist)

- **Sidebar — implementação concluída:** rail estreito de ícones com expansão/recolhimento vertical, teclado/foco acessíveis e suporte a `prefers-reduced-motion`. QA de release pode validar teclado/reflow no pacote.
- **Página do player — implementação concluída:** composição própria Animonkey com card de anime, player central e seletor de episódios; busca, variantes SUB/DUB reais, lista/grade, thumbnails e paginação limitada. QA visual/audiovisual do pacote está registrado no checklist ativo 1.0.
- **Capítulos na timeline:** os timestamps válidos do episódio devem aparecer como marcadores/capítulos utilizáveis na timeline do Vidstack, com rótulos e navegação corretos. Registrar um `Track` VTT `kind="chapters"` ativo em `MediaProvider`; `useChapterOptions` apenas lê as opções do track ativo. Emitir somente os intervalos reais de intro/outro, pois o slider preenche as lacunas com base na duração. O critério exige evidência no player em runtime; gerar ou anexar a track sem marcadores visíveis não aprova. Testar fonte com timestamps, sem timestamps e troca de episódio/fonte.
- **AniZip — implementação base concluída:** thumbnails de episódio são expostas via Anivexa e mostradas no Electron. A escolha de quaisquer outros campos é uma decisão futura de produto; se aprovada, normalização/cache fica na Anivexa, com origem, idioma, lacunas e IDs preservados. Não repassar o payload integral ao renderer nem inventar sequências de episódios.

**Estado da integração AniZip:** thumbnails/stills de episódio já são mapeadas pela API Anivexa e usadas pelo Electron. A cobertura integral dos campos AniZip e a escolha de enriquecimentos adicionais não fazem parte do aceite funcional atual; qualquer campo adicional exige decisão de produto na preparação do release, com origem, idioma, lacunas e IDs preservados. Não repassar o payload integral ao renderer nem inventar episódios especiais.

**Implementação registrada em 16–17/11/2026:** sidebar expansível, thumbnails e layout próprio do player foram conectados ao shell/listas; a track de capítulos emite somente intervalos válidos de intro/outro; a resposta integral AniZip permanece do lado Anivexa. O layout do watch foi refinado e a aceitação da Fase 8 foi registrada pelo usuário em 16/11. Critérios audiovisuais restantes e a confirmação da versão empacotada atual estão no checklist ativo de preparação do release 1.0.

### Fase 0 — Preparar repositório e baseline — concluída

- Confirmar/criar Git para `animonkey-electron`, remotes, branch padrão e origem do starter; preservar seus arquivos atuais.
- Adicionar `AGENTS.md` para arquitetura Electron, limites de segurança, stack/package manager e validações.
- Renomear metadados do app, documentar execução e build, estabelecer baseline de lint/typecheck/Forge e confirmar instalação reproduzível com pnpm (lockfile existente).
- Criar matriz rastreável requisito → issue/fase → evidência, incluindo todas as linhas do inventário deste plano.

**Saída:** repositório rastreado, starter reproduzível e critérios para detectar regressões definidos.

### Fase 1 — Fundação de UI e compatibilidade — concluída

- Fixar alias TypeScript/Vite, TanStack Router com `createHashHistory`, TanStack Query ligado aos loaders, tratamento global de erros, carregamento e layout da aplicação.
- Instalar/configurar shadcn/Radix de forma compatível com Tailwind v4; trazer tokens CSS, fontes, ícones e primitivas necessárias preservando licença e origem.
- Criar estrutura no destino para `app` (rotas do renderer), `components/features`, `components/layout`, `components/shared`, `components/ui`, `services`, `lib`, `hooks`, `context`, `types` e `electron` (main/preload), respeitando o starter existente.
- Definir política de links externos, janela, menu, atalhos e deep links sem abrir navegação remota arbitrária dentro da janela privilegiada.

**Saída:** navegação base e design system prontos sem copiar regras Next incompatíveis.

### Fase 2 — Camada de domínio e dados públicos — concluída

- Migrar primeiro contratos (`types`), funções puras (`lib`), normalização AniList/Anivexa sem segredo e serviços/cache desacoplados.
- Classificar cada import por ambiente: renderer-safe, main-only, web-only ou precisa de adapter. Remover `next/image`, `next/link`, `next/navigation`, `next/headers`, `server-only`, `process.env` do bundle renderer e `fetch` específico de Route Handler.
- Integrar as consultas existentes do catálogo AniList ao TanStack Query e migrar Home, busca, agenda, trending e recentes; preservar AniList como fonte dos metadados gerais, o filtro adulto, cache offline e contratos de query/cancelamento.
- No destaque da Home, usar Taizen apenas para o logo inglês validado e `art` (fundo `SHOWBACKGROUND` do hero); os outros metadados seguem vindo do AniList e `AniList.banner` é o fallback.
- Definir CSP/connect-src e permissões de rede apenas para destinos necessários.

**Saída:** catálogo e navegação de descoberta equivalentes, com estados de erro/offline e cache preservados.

### Fase 3 — Biblioteca do player e streaming — migração funcional concluída

- **Decisão e implementação:** Vidstack é o único player; Plyr foi removido. Fallback entre fontes/provedores permanece no controller Vidstack. Zustand contém somente a seleção compartilhada `{ episodeId, serverId }`. Smoke empacotado funcional e troca de fontes foram confirmados pelo usuário em 11/11/2026. A cobertura mais ampla de provider/formato/caption e timestamps está na preparação do release 1.0.
- Fixar e documentar versões compatíveis de `@vidstack/react` e dependências. Confirmar integração com React 19, Vite 5, Electron/Chromium empacotado e build Windows. JASSUB/WASM só entra novamente se a matriz real provar necessidade de libass.
- Marco técnico: `@vidstack/react` 1.15.7 tem peer dependencies para React 18/19. `VideoPlayer` carrega exclusivamente `VidstackVideoPlayer`, que reutiliza Source Resolver, Playback Controller, HLS.js/dash.js, tracks, capítulos e progresso. `VITE_PLAYER_ENGINE` foi removido; não existe engine alternativo. `pnpm package` Windows x64 passou após a limpeza. Compilar/empacotar não confirma compatibilidade audiovisual.
- Source Resolver e Playback Controller já estão implementados para a única engine Vidstack. O resolver decide URL/MIME; `usePlaybackController` centraliza dedupe e sequência de fallback de fonte. Validar troca e falhas em runtime antes de ampliar autoridade para estado de mídia ou lifecycle.
- Usar a biblioteca de captions do Vidstack para validar VTT, SRT, SSA/ASS e JSON conforme as fontes reais. Avaliar JASSUB/libass somente para arquivos ou estilos que não atinjam paridade pelo renderizador de captions; não duplicar processamento sem necessidade.
- Isolar player e dependências (Vidstack, HLS.js, dash.js e, se necessário, JASSUB/WASM/Workers) no renderer; configurar assets de build e caminhos de produção.
- Manter Playback Controller fino para falhas/seleção e Source Resolver para formato, MIME e metadados. Detalhes de provider, proxy, headers, tokens e transformação ficam no adapter correspondente; nunca transferir segredos ao Zustand.
- Zustand em `src/stores/playback-session-store.ts` mantém apenas a seleção `{ episodeId, serverId }`, compartilhada entre o seletor da página e o fallback do player. Episódio continua vindo da URL; lista de servidores e dados/credenciais das fontes continuam em estado local/serviços. Não persistir nem guardar URLs, headers, progresso, tempo, buffering, volume ou tracks efetivos no store; Vidstack continua autoridade sobre mídia ao vivo.
- Implementar a estratégia de acesso ao provider: backend/proxy HTTPS existente no primeiro corte; preservar Referer, Authorization, Range, token/chave de manifesto, segmentos e fallback. Não assumir que CORS permite chamada direta nem que URL de embed substitui HLS/DASH.
- Não propagar `Authorization` a URLs diretas ou hostnames arbitrários lidos de manifests/playlists; enviar credenciais somente ao proxy local confiável ou a origens explicitamente permitidas.
- Adaptar protocolo de mídia/URLs e testar as mesmas fontes, troca de episódio, troca de servidor, retomar progresso, captions VTT e renderização ASS/SSA.
- Preservar os contratos de providers, proxy e progressão documentados em `docs/player-subtitles.md` e `docs/provider-streaming.md`. A sequência especial de preparação ASS antes do HLS e o ciclo destroy de JASSUB só permanecem se o adapter JASSUB continuar necessário; nesse caso, preservar worker/WASM no Forge.
- **Critérios de QA de release — coleta/análise de providers e legendas:** para cada fonte realmente usada, registrar de forma sanitizada provider/server, tipo de stream, audio/sub, `subtitleType`, tracks, formato/idioma, `default`, grupos HLS `EXT-X-MEDIA`, categorias de headers (sem valores) e se soft-sub/hard-sub/unknown foi confirmado. Comparar metadata com o menu real; não inferir soft-sub pela presença de um arquivo. Anexar evidência sem segredos se as fontes estiverem disponíveis.
- **Critérios de QA de release — captions e timeline:** em fontes reais, confirmar sincronização durante play/pause/seek, troca de episódio, seleção de idioma e fullscreen. Quando houver `intro`/`outro` válido, confirmar intervalo visível, rótulo e salto acessível, limpeza ao trocar mídia, marca ausente/inválida, seek manual e troca rápida. Sem fonte ou metadata real, registrar a cobertura como não disponível; não inferir aprovação.

**Saída funcional registrada:** Vidstack/proxy/fallback foram integrados e o smoke funcional empacotado, incluindo troca de fonte, foi confirmado pelo usuário em 11/11/2026. Isso não declara cobertura integral de áudio, captions, formatos ou timestamps. A matriz detalhada por formato, provider, caption e timestamp é critério de QA do release 1.0 na fila abaixo; ela não mantém esta fase de migração aberta.

#### Decisão Vidstack e manutenção

- **Decisão atualizada em 10/11/2026:** Vidstack é o único player por decisão explícita do usuário. Plyr foi removido como backup antes da validação final; a aplicação não mantém troca automática ou manual para outro engine. Em 11/11/2026, o usuário confirmou o smoke funcional do app empacotado e a troca de fonte; a adoção funcional está `COMPLETED`, enquanto a cobertura audiovisual mais ampla permanece na fila 1.0. `TD-PLAYER-001` segue adiado por decisão do usuário e não faz parte do aceite desta etapa.
- A documentação oficial do Vidstack declara manutenção de segurança apenas para a linha 1.x, com patches prioritários até janeiro de 2028, e direciona o desenvolvimento ativo para Video.js 10. Esse risco foi aceito para o plano atual; isso não significa suporte funcional garantido até essa data.
- Manter contratos de source e Playback Controller independentes da API Vidstack, registrar versão suportada, revisar avisos de segurança/manutenção em cada release e reavaliar biblioteca antes de janeiro de 2028. Uma eventual mudança futura de player deve ser implementada por adapter e não alterar contratos de provider ou dados.
- Vidstack documenta VTT, SRT, SSA/ASS e JSON na biblioteca de captions; SSA/ASS pode ser mapeado para VTT estendido pelo renderizador. Há plugin opcional de libass via JASSUB. Testar estilo, posicionamento, encoding, temporização, troca de track, fullscreen e desempenho com os arquivos/provedores reais; a lista de formatos, sozinha, não comprova paridade visual.
- Compatibilidade React 19/Electron 43 e produção Windows x64 é item de validação deste projeto. A documentação web do Vidstack não é evidência de smoke no Electron empacotado.
- Vidstack permite captions VTT/SRT/SSA/ASS/JSON pelo `Track`. JASSUB/libass não está instalado nem integrado após a remoção do renderer Plyr; reintroduzir somente para casos reais que não atinjam paridade no renderer Vidstack.
- O tamanho das captions Vidstack deve ser controlado pelo seletor nativo em **Acessibilidade → Estilos de legenda → Fonte → Tamanho**, que aplica `--media-user-font-size` sobre `--media-cue-font-size`. Não adicionar escala própria em paralelo. O estilo padrão compartilhado do player mantém texto branco com contorno/sombra escura e sem fundos no display ou nos cues; a CSS do renderer Vidstack padroniza isso para todos os formatos de track, inclusive anulando tamanhos/cores/fundos por formato para que o seletor nativo seja a autoridade visual comum.
- O preset visual segue a preferência confirmada pelo usuário: texto branco, sombra suave, transparência no fundo e tamanho pelo controle nativo. A legenda selecionada automaticamente é apenas PT-BR; quando ela não existe, captions ficam desativadas até seleção manual.
- O seletor de playback tem dois níveis: provedor e subservidores daquele provedor. Os campos de provider e server precisam permanecer separados no contrato; provedores/streams com PT-BR são priorizados, e English aparece depois dentro de cada provedor.
- Débitos observados de captions devem ser registrados em [technical-debt/README.md](../technical-debt/README.md), com evidência, formato/provider ainda que sanitizados, hipótese separada de causa e critério de aceite. `TD-PLAYER-001` registra texto/comandos fora de contexto e quebras de linha; foi deliberadamente adiado para investigação futura.
- O Source Resolver em `src/lib/player-source-resolver.ts` decide proxy/direto/embed permitido e MIME HLS/DASH/MP4 para Vidstack.
- O hook `usePlaybackController` deduplica erros e aplica a sequência proxy → HLS direto sem playlistKey → próximo servidor → embed HTTPS permitido → erro amigável. Não possui o elemento `<video>` nem toma autoridade sobre tempo, estado de captions ou teardown, que continuam no adapter Vidstack.
- Referência de estilo e controles: [Captions — Vidstack](https://vidstack.io/docs/player/components/display/captions/). A seleção de tamanho pertence ao menu de acessibilidade/estilos da layout default, não a um seletor customizado no menu de tracks.
- Referências oficiais: [status do Vidstack](https://vidstack.io/docs/player/), [formatos e carregamento de captions](https://vidstack.io/docs/player/core-concepts/loading/) e [integração opcional JASSUB](https://vidstack.io/docs/player/core-concepts/loading/).

#### Verificações atuais de faixa e elegibilidade

> Esta subseção registra o comportamento observado no player legado Plyr e serve de baseline de comparação; não define automaticamente a implementação de captions no Vidstack.

- O adapter procura idioma nos campos `srclang`, `lang`, `label` e `language`, tanto em tracks do stream quanto do payload, e normaliza apenas português (incluindo PT-BR) e inglês para os badges atuais.
- Tracks duplicadas pelo mesmo URL são consolidadas. O formato ASS/SSA é reconhecido pela extensão no pathname da URL. No player, `filterSubtitles` mantém apenas captions com idioma conhecido (PT-BR/EN) e no máximo uma faixa por idioma.
- Antes desta etapa, fonte sem idioma detectado era descartada salvo título adulto/Hentai. Agora `subtitleType: hardsub` explícito também mantém a fonte e a identifica como embutida; `softsub` com tracks segue selecionável. `unknown` não é uma confirmação visual de nenhum dos dois casos.
- Limitação conhecida para QA do release: metadados podem omitir idioma/extensão ou declarar softsub/hardsub incorretamente, e HLS pode anunciar captions no próprio manifesto. Comparar API, playlist, menu real e imagem de vídeo antes de alterar filtros. As notas de escala WebVTT/Plyr e ASS/SSA desta linha descrevem somente o player legado; a escala atual é controlada pelo menu nativo Vidstack.

### Fase 4 — Persistência e experiência offline — concluída

- Reusar IndexedDB no renderer quando viável; verificar segurança de origem/storage no Electron, migrações de schema, quota, limpeza e recuperação.
- O cache público do catálogo mantém registros vencidos para fallback offline por até 30 dias após o TTL; a limpeza deve preservar esse período e remover os registros antigos gradualmente quando novas consultas forem gravadas.
- Preservar `watch-later`, histórico, continue-watching, preferências e cache público; não conflitar stores de dados privados com cache de catálogo.
- Implementar export/backup local e política de migração dos dados web: não assumir que IndexedDB do Chromium do site é visível ao app desktop; oferecer importação explícita se desejado.
- Tratar o conteúdo do backup importado como entrada não confiável e validar o esquema e os campos aninhados antes de iniciar qualquer gravação; mesclar em uma transação para evitar importação parcial.
- Manter os princípios offline-first e LWW para dados do usuário e validar troca de conta sem vazamento de dados entre perfis.

**Saída:** dados sobrevivem restart/upgrade; operações offline, reconcile, conflito, troca de conta e recuperação de falha são verificáveis.

### Fase 5 — Conta, autenticação e sincronização — concluída

- O desktop usa Supabase Edge Function dedicada `desktop-api` em HTTPS. O app web antigo permanece independente e não é requisito para a autenticação/sync desktop.
- A correção web usa bcrypt-ts para cadastro, login e troca de senha; login aceita somente hashes. O banco tinha as quatro tabelas vazias do Auth.js e objetos de trigger incompletos; em 11/11/2026 foram aplicadas as tabelas Auth + Sync com zero usuários legados, então não há senhas existentes para migrar.
- Fluxo desktop implementado em `desktop-api`: o processo main envia credenciais por HTTPS; renderer nunca recebe tokens. Access token opaco de 10 minutos fica em memória e refresh opaco rotativo por até 30 dias é persistido com `safeStorage`. O servidor guarda hashes dos tokens, associa sessão a usuário/dispositivo e revoga a família após replay. Login usa bcrypt-ts e limitação de tentativas.
- Como a Edge Function valida o access token opaco, a função está configurada com `verify_jwt=false`; cada operação exige token bearer, hash ativo, sessão válida e deriva o usuário no servidor. Logout revoga a sessão e todas as operações filtram pelo `user_id` autenticado. Nunca aceitar `user_id` definido pelo renderer.
- Expor ao renderer apenas operações IPC tipadas de alto nível e seus dados de domínio. Não expor token, `ipcRenderer`, fetch genérico ou acesso a filesystem. Se `safeStorage` não tiver criptografia disponível no sistema, não persistir refresh token e pedir login após reiniciar; identidade local criptografada restaura o escopo offline sem esperar rede, enquanto refresh/reconcile seguem em segundo plano.
- A biblioteca local usa IndexedDB v6 com `scopeId` nas chaves compostas de Assistir Depois, progresso e avaliações. Registros v4 existentes são migrados ao perfil `guest`; a criação do store de ratings é aditiva no upgrade v5→v6. Alternar conta limpa e recarrega a vista para o perfil daquela conta. Mesclar dados guest à conta exige ação explícita.
- O reconcile cobre `watch_later`, `episode_progress` e `anime_ratings`, resolve conflitos pelo timestamp LWW e envia remoções por tombstones. Ratings aceitam nota inteira 1–10 e comentário opcional até 2000 caracteres, com gravação offline-first; gravações de progresso do player são agrupadas por debounce com flush máximo de 30 segundos.
- O perfil desktop permite alterar o nome autenticado por operação server-side associada à sessão; exportação de conta inclui perfil e dados próprios de biblioteca, progresso, avaliações e atividade, sem tokens/sessões. O backup local v2 também inclui ratings e continua aceitando arquivos v1.
- Troca de senha verifica a senha atual com bcrypt-ts, limita a nova a 8–72 bytes e compartilha o rate limit server-side. Avatar aceita JPG/PNG/WEBP/GIF até 2 MiB, valida assinatura, grava somente no prefixo do usuário e atualiza a sessão após upload/remoção.
- Privacidade `show_activity` é opt-in; o feed paginado usa cursor composto por timestamp/ID e retorna somente autores com compartilhamento ativo. `started_watching` cobre INSERT e UPDATE do progresso, com índice único parcial por usuário/anime para manter o evento idempotente; a UI atualiza ao recuperar foco, após sync e sob ação manual.
- Nunca incluir chaves secret/service-role, JWT secret ou segredo de NextAuth no desktop. O cliente recebe somente URL da Edge Function e publishable key; a função usa credencial server-side do ambiente Supabase. Operações privilegiadas e ownership ficam no servidor; manter RLS.
- Perfil, senha, avatar, export e privacidade/feed estão implementados no Electron; validar contratos no smoke autenticado e manter fora do pacote tokens/segredos e identidade fornecida pelo renderer.

**Saída registrada:** os fluxos desktop de conta/sync foram entregues por `desktop-api`; smoke remoto descartável confirmou operações e limpeza dos registros temporários. Esta fase não exige atualizar o site web, que continua independente. Evidência por operação e validações históricas estão em [MIGRATION_PROGRESS.md](./MIGRATION_PROGRESS.md).

### Fase 6 — Watch together e recursos complementares — fora do escopo desktop atual

- PartyKit, salas, chat e presença permanecem no produto web; não há implementação de Watch Together no Electron.
- Dashboard/admin, DMCA/termos, analytics web e recursos auxiliares não integram o desktop atual. Não distribuir credenciais administrativas.
- Qualquer inclusão futura depende de priorização de produto; isso não bloqueia o encerramento da migração já aceita.

**Saída desta auditoria:** os itens omitidos estão classificados no inventário e no tracker como web-only/adiados; nenhum deles é contado como tela desktop migrada.

### Fase 7 — Endurecimento e distribuição — preparação do release 1.0

- Rever Electron security checklist: permissões, navegação, IPC, CSP, fuses, atualização, logs sem credenciais, armazenamento de tokens e limpeza de dados.
- Conferir licenças e notices das dependências novas e distribuídas, especialmente player/JASSUB, codecs e fontes.
- Windows x64 é o alvo inicial escolhido pelo usuário. A configuração também declara makers Squirrel para Windows, ZIP para macOS e DEB/RPM para Linux, mas somente Windows x64 tem artefatos de validação registrados. Preparar assinatura/notarização, auto-update e pipeline; decidir separadamente se outros sistemas, arquiteturas ou canais entram no release.
- A Anivexa é distribuída junto com o Electron pelo submódulo fixado `vendor/anivexa-api`; Forge prepara dependências de produção para o alvo local e copia o runtime a `resources/anivexa-runtime`. O main inicia o handler em `utilityProcess` e encaminha operações via IPC tipado. O smoke real Windows x64 comprovou o fluxo renderer→IPC→`/episodes/21`→`/watch/21` e reprodução por AnimeDunya. Ampliar a matriz de providers/fontes, falhas, cancelamento e formatos na preparação do release.
- O workflow/script de monitoramento de fontes foi removido em `ca4a8e5`. Na preparação do release 1.0, decidir se monitoramento externo é necessário e integrá-lo à decisão de auto-update/pipeline; não recriar agora.
- Validar instalação limpa, upgrade, rollback/recuperação e desinstalação para cada plataforma escolhida; verificar HiDPI, teclado, consumo e políticas de assinatura.

**Saída futura:** plataformas e canais aprovados, pacote/instalador reproduzível, política de assinatura explícita, ciclo de auto-update definido e roteiro de instalação/upgrade/rollback validado. Esta saída pertence ao release 1.0, não à migração.

### Fase 8 — Paridade visual e QA lado a lado — encerrada por aceite do usuário em 16/11/2026

- O gate da fase foi aceito pelo usuário após os ajustes registrados em 16/11/2026. As comparações e capturas antigas abaixo são diagnósticos históricos, não uma solicitação ativa para reabrir a migração.
- A revisão completa rota a rota e a confirmação do pacote mais recente permanecem critérios de QA do release 1.0, com escopo e critérios específicos na fila abaixo. Não afirmar que cada estado visual foi revalidado nesta auditoria.
- Tipografia global do Electron: manter Rubik, texto de corpo em 16 px e piso de 12 px para textos de interface pequenos (`text-xs` do Tailwind). Aplicar também a labels, badges, metadados, contadores, tooltips, placeholders e controles em todas as rotas; corrigir o espaço ou truncamento antes de encolher texto. Escala de captions Vidstack continua regida pelo seletor nativo de acessibilidade.
- Exigir paridade visual total nas páginas de informações do anime e player: hierarquia, banner/poster, tipografia, espaçamentos, botões, tabs/listas, proporções do vídeo, seletores de episódio/servidor, captions e estados loading/erro/vazio.
- No detalhe do anime, manter o banner até as extremidades da área de conteúdo e manter pôster, textos, ações, badge do próximo episódio, abas e lista alinhados à régua interna `max-width`/gutter do legado.
- Entre o hero e a sequência de abas/lista, não inserir divisor horizontal: o código antigo segue do hero para o conteúdo principal sem essa linha. Nos cartões de relações, portar `getSeasonPartBadge` do `anime-page-client.tsx`: reconhecer `Season N`/`Nth Season` no título e combinar com um rótulo legível da relação em PT-BR (por exemplo, `Temporada 2 · Sequência` para `SEQUEL`), no canto superior direito do poster.
- No detalhe e na lateral do player, portar os filtros existentes no legado: busca por nome/número (e descrição no detalhe), ordem crescente/decrescente; no detalhe também alternância grade/lista e paginação de oito itens; na lateral do player paginação em grupos de 50, filtros ALL/SUB/DUB derivados das variantes reais e alternância de visualização. Mostrar thumbnails, destacar o episódio selecionado e preservar pesquisa, ordenação, navegação e IDs da Anivexa. Paginação no renderer limita os cards montados, não o payload da rota `/episodes/:id`; a solução de payload/cursor pertence à API Anivexa.
- Manter Personagens em carrossel horizontal com controles acessíveis e snap, para não alongar a página; manter Relações em grade compacta e responsiva de posters 3:4, com várias colunas. Mostrar dublador japonês (nome/imagem) quando fornecido pelo AniList; relações podem mostrar formato/duração, status, estação/ano, episódios, nota, gênero e sinopse, usando apenas os dados do `getAnime` existente, sem rótulos de classificação etária ou métricas que a API não fornece.
- Limitação confirmada por introspecção/teste da API: `Media.description` não aceita idioma e retorna um único texto por obra; os exemplos consultados vieram em inglês. Não vincular sua língua ao seletor EN/JP de títulos nem inferir suporte PT-BR; tradução/localização exige fonte ou etapa separada.
- **Step de QA do player — captions, timestamps e thumbnails:** com fontes reais, verificar sincronização de captions durante play/pause/seek, seleção de idioma, fullscreen e troca rápida de episódio/provider; quando `intro`/`outro` tiverem timestamps válidos, conferir limites, rótulos, salto acessível e limpeza ao trocar mídia. Para previews da timeline, conferir o track `thumbnails` WebVTT, parsing de timestamp/`xywh`, carregamento das sprites via proxy/CSP e preview no ponto correto; trocar episódio/fonte rapidamente e confirmar que URLs e imagens antigas são descartadas. Repetir casos sem track, URL quebrada, timestamp inválido e seek manual; comparar com o web no mesmo provider/episódio/timestamp/viewport. Registrar cada formato/provider validado; sem fonte real, o caso permanece pendente.
- No player, incluir as captions sincronizadas com a mídia e os marcadores clicáveis de intro/outro na timeline do episódio quando existirem timestamps válidos do provider; confirmar que mudam corretamente ao trocar o episódio.
- Confirmar que as rotas ocupam a área útil completa entre sidebar e topbar, sem max-width/margem global que comprima o conteúdo; componentes internos podem manter gutters próprios. Páginas de detalhe não devem ganhar moldura externa sem existir na referência.
- Testar imagens remotas na build empacotada. A CSP deve permitir somente origens públicas necessárias e derivar a origem Supabase da URL pública configurada; verificar renderização de avatar, posters e thumbs.
- Registrar rota, viewport, estado comparado, diferenças encontradas e evidência visual; corrigir diferenças antes de marcar cada rota como paridade completa.

**Verificação inicial em 11/11/2026 (histórico):** comparação diagnóstica de `/anime/159042` e `/watch/159042`; janelas e estados não pareados. As lacunas anotadas motivaram implementações posteriores. O status `IN_PROGRESS` daquela sessão foi substituído pelo aceite de fase registrado em 16/11/2026; não constitui estado atual.

**Inventário estático comparativo em 11/11/2026 (histórico):** leitura dos layouts e rotas. A fonte global Rubik foi corrigida no Electron com arquivos locais; shell/sidebar/topbar continuam adaptação intencional. A tabela abaixo preserva as diferenças observadas na época. Os status e “próximas verificações” nela não são tarefas atuais da migração; ver a fila de release 1.0.

**Comparação visual inicial da Home em 11/11/2026 (histórico):** Chrome e Electron foram observados em 1920×1080; as capturas não foram simultâneas e os estados de conta/idioma não estavam pareados. As diferenças registradas motivaram refinamentos e a decisão de manter a sidebar desktop e recolher a busca durante a rolagem. Esta observação não é a base isolada do aceite final.

| Página/área                          | Referência web                                                                                           | Estado e disparidade conhecida no Electron em 11/11/2026                                                                                                                                                                                          | Próxima verificação indicada naquela data (histórico)                                                                                                              |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Shell e navegação                    | Navbar superior responsiva, transição de página e footer                                                 | Sidebar + topbar desktop; adaptação deliberada. Rubik corrigida nesta etapa. Tokens diferem (`#111111`/`#2caf57` no legado contra `#0b0b0c`/`#49d77a` no Electron); altura do header, gutters e janela menor ainda precisam ser comparados.       | Mesma resolução útil; conferir menu, foco, scroll, gutters e conteúdo até as bordas.                                                                               |
| Home                                 | Hero, continuar assistindo, assistir depois, atualizações, tendências e agenda lateral                   | Hero e composição próprios; listas/agenda diferentes, e continuar/assistir depois ficam em rotas próprias em vez de ocupar a Home.                                                                                                                | Comparar dobra inicial e rolagem completa; registrar ordem, proporções e estados vazios.                                                                           |
| Busca                                | Breadcrumb, filtros laterais, cards animados e paginação                                                 | Filtros compactos com seletores pesquisáveis, chips de seleção e grupos avançados; URL preserva critérios/paginação; gêneros/tags vêm do AniList. Grid adaptado ao Electron.                                                                      | Comparar filtros, cards, paginação, carregamento e layout no mesmo viewport; revisão runtime visual PENDENTE.                                                      |
| Tendências e atualizações            | Páginas dedicadas para Em alta e Lançamentos; abas locais para completos e recém adicionados na Home     | Rotas dedicadas só para `trending` e `updates`; abas da Home exibem completos/recém adicionados, sem telas redundantes na sidebar.                                                                                                                | Conferir as duas páginas dedicadas e validar que as abas da Home continuam alternando coleções.                                                                    |
| Informações do anime                 | Hero/banner, poster, título/idioma, ações, tabs Episódios/Personagens/Relações, recomendados e avaliação | Hero/metadados/ações, avaliação, abas, filtros/paginação de episódios, carrossel de personagens (voz japonesa) e grade compacta de relações implementados. Ainda sem aceite visual pareado; limitação AniList: sinopse não tem seleção de idioma. | Prioridade máxima: comparar `/anime/212888` no mesmo viewport, estados e scroll; verificar pôster/banner, transição com topbar, abas, ações, relações e avaliação. |
| Player                               | Player e lista de episódios/servidores, informações e navegação contextual                               | Fluxo Vidstack migrado, composição desktop própria. Paridade visual/audiovisual não aprovada. QA de captions sincronizadas e marcadores intro/outro dependem de fonte/timestamps reais.                                                           | Prioridade máxima: estado vazio, reprodução, troca de episódio/fonte, captions e timeline com timestamps.                                                          |
| Agenda                               | Calendário semanal/diário e alternância de idioma do título                                              | Seletor de data e cards em composição diferente.                                                                                                                                                                                                  | Igualar data/horário e títulos; comparar navegação e densidade da lista.                                                                                           |
| Conta e configurações                | Hub de conta com estatísticas e tabs de biblioteca; configurações separadas                              | Autenticação/conta ficam em Settings; biblioteca em rotas dedicadas. Funções migradas, arquitetura visual diferente.                                                                                                                              | Comparar identidade, sessão, avatar, estatísticas, formulários, feedback e estados sem rede.                                                                       |
| Assistir depois / continuar          | Tabs dentro do hub da conta e módulos na Home                                                            | Rotas próprias. Conferir consistência de cards, remoção, progresso e estados vazios.                                                                                                                                                              | Comparar listas com conta e biblioteca equivalentes.                                                                                                               |
| Feed de atividade                    | Cards com avatar, poster e título do anime                                                               | Feed/sync e evento `episode_completed` implementados; Electron ainda exibe `Anime #<id>` sem resolver título/poster como o legado. Avatar no cabeçalho foi conferido, mas no card não tem aceite visual.                                          | Gerar atividade real e comparar avatar, título/poster, timestamp, paginação e opt-in.                                                                              |
| Login/registro                       | Rotas próprias                                                                                           | Ações integradas em Settings; rota web separada não tem destino visual dedicado no Electron.                                                                                                                                                      | Avaliar se o fluxo em Settings é claro e completo, incluindo erro e sessão persistida.                                                                             |
| DMCA, termos, admin e Watch Together | Rotas presentes no legado                                                                                | Não há equivalentes completos; Watch Together e complementos continuam `NOT_STARTED`/adiados.                                                                                                                                                     | Classificar escopo de migração antes de planejar paridade; não contar como rota visual concluída.                                                                  |

**Escopo daquela rodada (histórico):** leitura de código e registro de diferenças. A nota de pendência abaixo foi superada pelo aceite de 16/11; QA adicional agora pertence à fila 1.0.

**Implementação da Home Electron em 11/11/2026 (histórico):** composição portada conforme `components/features/home/home-content.tsx` do legado: hero com banners rotativos, ações assistir/assistir depois, continuar assistindo, atualizações, tabs e agenda. A sidebar desktop foi preservada conforme decisão do usuário. A busca e o seletor EN/JP foram integrados. O pedido de validação ainda aberto naquela data foi substituído pelo aceite da Fase 8 em 16/11; smoke do pacote após as correções Taizen recentes permanece na fila de release.

**Ajustes transversais da UI em 11/11/2026:** trilhos da Home adotaram carrossel horizontal reutilizável com setas, rolagem por gesto/trackpad e teclado, e barra visualmente oculta. O shell agora centraliza e aplica padding responsivo em Search, Catálogos, Agenda, Biblioteca, Feed e Configurações; Home já possui seu frame próprio. Anime e Player permanecem sem frame externo, conforme exceções definidas. Schedule recebeu navegação por semana/dia, estado da data selecionada e cards responsivos com capa, horário e episódio. TypeScript, ESLint e Prettier passam. A janela Electron mais recente está em `/recent?page=2`; a inspeção visual específica de Home/Schedule e dos carrosséis continua pendente.

**Refino do banner da Home em 11/11/2026:** a arte panorâmica preenche o hero usando `object-cover`, preservando a proporção e cortando uniformemente as laterais necessárias; `object-position` prioriza a região central. Poster de fallback usa foco elevado. Gradientes direcionais e sombra interna mantêm a leitura do texto. A validação visual no runtime ainda deve conferir diferentes banners e o fallback de poster.

**Conferência nativa da Home em 11/11/2026:** janela Electron 1920×1032, rota `/`, captura após o refino mostrou imagem cobrindo o hero sem a faixa estreita vista anteriormente; título, descrição e ações permanecem legíveis. Esta é uma conferência isolada do Electron, não comparação com o site legado. A Agenda é a próxima rota da rodada; a interação nativa pediu refresh do estado antes de mudar de tela e ficou pendente.

**Simplificação da navegação em 11/11/2026:** removidas as entradas de sidebar “Mais populares”, “Concluídos” e “Adicionados recentemente” e suas rotas dedicadas (`/popular`, `/completed`, `/recent`). As coleções concluídos e recém adicionados continuam acessíveis pelas abas da Home; “Em alta” permanece em Trending. Rotas removidas caem no redirecionamento geral para Home.

**Registro histórico:** a avaliação página por página e o step de captions/timestamps foram pedidos em 11/11/2026. A Fase 8 foi depois aceita pelo usuário em 16/11; as verificações de release que ainda fazem sentido estão no checklist ativo 1.0.

**Saída da Fase 8:** aceite de produto registrado em 16/11/2026. A saída de QA do release 1.0 é definida no [checklist ativo](../releases/1.0-checklist.md) e não altera esse status.

## Encerramento da migração e preparação do release 1.0

A migração permanece encerrada e não é reaberta por validações de release. A fila ativa, seus estados e a evidência por candidato agora são mantidos em [1.0-checklist.md](../releases/1.0-checklist.md). A auditoria detalhada e os registros datados foram preservados em [MIGRATION_PROGRESS.md](./MIGRATION_PROGRESS.md).

## Critérios de estabilidade e acompanhamento

- O estado do plano é encerrado como decisão de produto; não usar `NOT_STARTED`/`IN_PROGRESS` de registros históricos para reabrir a migração. A fila do release registra cada validação ou decisão restante com critério explícito.
- Preservar as entradas históricas em `MIGRATION_PROGRESS.md`; as frases “próximo passo” dentro de entradas datadas descrevem somente aquele momento, salvo se repetidas no checklist ativo 1.0.
- A matriz deste plano registra destino, evidência e classificação. Um build, compilação ou presença de UI não comprova reprodução audiovisual, instalação nem paridade por si só.
- Em cada release candidata, verificar que o `animonkey` web continua independente e utilizável; não fazer cutover nem alterações web como consequência da migração Electron.
- Preservar dados: nenhuma migração de IndexedDB/cache ou formato de progresso é feita sem versão, backup/estratégia de recuperação e teste de upgrade.

### Critérios adicionais de aceite da modernização

- Vidstack está encapsulado pelo Playback Controller, integrado ao Zustand sem duplicação de autoridade e consegue trocar source e limpar listeners/recursos no ciclo de vida correto; não há troca de engine.
- Source Resolver preserva formatos, MIME types, legendas e metadados necessários; HLS/DASH mantêm o proxy, headers, autenticação, Range e reescritas exigidas por provider.
- Captions VTT, SRT, SSA/ASS e JSON são verificadas com fixtures/fontes representativas; integração JASSUB só é considerada aprovada após validação visual e de ciclo de vida quando necessária.
- IPC introduzido tem contratos compartilhados, canais permitidos, validação de origem/payload, erros padronizados, unsubscribe e timeout/cancelamento quando aplicável. Se nenhuma capacidade privilegiada nova precisar de IPC, manter a bridge mínima existente e registrar essa decisão.
- Service Manager só é implementado para serviços/processos que o app efetivamente precise iniciar ou supervisionar; chamadas HTTP remotas não justificam, por si, um gerenciador de processos.
- Smoke do pacote Windows x64 e combinações de fontes/formatos com evidência histórica estão listados na fila de release. Formatos sem fixture/fonte disponível não são declarados validados.

## Decisões já tomadas e decisões futuras

- **Resolvido:** o site web permanece independente; conclusão da migração não autoriza desligá-lo ou alterá-lo.
- **Resolvido:** Vidstack é o único player; não introduzir Plyr/engine alternativo.
- **Resolvido:** conta e sync desktop usam `desktop-api` dedicada em HTTPS, sem depender do site Next.
- **Resolvido:** a Anivexa deve ser distribuída junto com o Electron. O fork é fixado em `vendor/anivexa-api`; o runtime é preparado pelo Forge, executado em `utilityProcess` e acessado por IPC tipado.
- **Para preparar/validar no release 1.0:** validação real por provider e player; empacotamento/distribuição inicial Windows x64; assinatura, auto-update, pipeline, instalação/upgrade/rollback e monitoramento externo. Decidir eventual expansão de sistemas/canais, importação do perfil web ou enriquecimento AniZip adicional.
- **Adiado fora do desktop:** Watch Together, admin, DMCA/termos e métricas próprias; não são bloqueios de migração.

## Referências do repositório web

- [AGENTS.md](../animonkey/AGENTS.md) — arquitetura, integrações e fluxo de trabalho do site.
- [CLAUDE.md](../animonkey/CLAUDE.md) — convenções atuais de frontend; regras específicas de Next devem ser reinterpretadas para o renderer Electron, não copiadas literalmente.
- [docs/README.md](../animonkey/docs/README.md) — índice de documentação.
- [docs/implementation-progress.md](../animonkey/docs/implementation-progress.md) — estado da implementação Auth + Sync.
- [docs/sync-architecture.md](../animonkey/docs/sync-architecture.md) — IndexedDB, Supabase, reconcile e LWW.
- [docs/provider-streaming.md](../animonkey/docs/provider-streaming.md) e [docs/player-subtitles.md](../animonkey/docs/player-subtitles.md) — contratos e restrições do player.
- [docs/env-variables.md](../animonkey/docs/env-variables.md), [docs/nextauth-setup.md](../animonkey/docs/nextauth-setup.md), [docs/supabase-setup.md](../animonkey/docs/supabase-setup.md) e [docs/database-schema.md](../animonkey/docs/database-schema.md) — segredos, auth e dados remotos.
