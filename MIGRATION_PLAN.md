# Plano de migração — Animonkey para Electron

## Objetivo e princípio de segurança

Migrar a experiência do `animonkey` (Next.js 16, React 19, TypeScript, Tailwind CSS 4 e shadcn/Radix) para o starter `animonkey-electron` (Electron Forge, Vite, React 19 e TypeScript), mantendo todas as funcionalidades existentes e sem interromper nem reestruturar o repositório web durante a migração.

O repositório web continua sendo a referência funcional e uma aplicação independente. A migração ocorre no repositório Electron por fatias verticais, com inventário e critérios de aceite por funcionalidade. Nenhuma feature é considerada migrada apenas por ter sua tela copiada: seus estados, fluxos, persistência, erros, acessibilidade e integrações também precisam funcionar.

## Estado observado

- `animonkey` tem App Router com páginas de catálogo, busca, agenda, anime, player, conta, feed, admin e watch-together; Route Handlers de autenticação, dados, streaming e proxy; serviços, hooks, contexts, caches IndexedDB, workers e servidor PartyKit.
- A base inclui AniList GraphQL, Anivexa, Supabase/NextAuth, sync offline-first, HLS, MPEG-DASH, WebVTT, ASS/SSA/JASSUB e sincronização social via PartyKit.
- No início da migração, `animonkey-electron` era o starter: `src/app.tsx`, `src/main.ts`, `src/preload.ts`, `src/renderer.ts`, Vite separado por processo e Tailwind 4. O trabalho inicial já adicionou React Router, configuração shadcn, shell e features de catálogo; player e integrações de usuário seguem pendentes.
- O destino agora tem controle Git local na branch `main`, acompanhando `origin/main` em `https://github.com/DaniHRE/animonkey-electron`; foi adicionado `AGENTS.md` local de arquitetura e segurança. O plano não pressupõe alterações no histórico do repo web.
- Diagnóstico conferido em 10/11/2026, antes desta atualização documental: `main` estava sete commits à frente de `origin/main` e o working tree não tinha alterações. O app usa Electron Forge 7.11, Vite 5, React 19, TypeScript estrito e pnpm; o player de `src/components/features/player/video-player.tsx` usa Plyr 3.8.5, HLS.js, dash.js e JASSUB. O preload expõe somente a plataforma; não há handlers IPC, Zustand, Playback Controller, Source Resolver ou Service Manager identificados. Estado de interface está em React; cache, preferências e progresso ficam no IndexedDB do renderer. Não foram encontrados testes automatizados.
- A decisão de produto registrada em 10/11/2026 é usar **Vidstack como player principal**. O principal benefício esperado é sua biblioteca de captions, que documenta VTT, SRT, SSA/ASS e JSON, além de integração opcional com libass via JASSUB. Essa capacidade é da biblioteca de captions/renderização do Vidstack, não implica que todos os providers ou captions embutidos sejam automaticamente selecionáveis; a compatibilidade de cada fonte continua sujeita a validação.
- Risco de ciclo de vida: a documentação oficial do Vidstack declara manutenção somente de segurança para a linha 1.x, com patches prioritários até janeiro de 2028, e que o desenvolvimento futuro ocorre em Video.js 10. A escolha de Vidstack permanece aprovada para este projeto, mas a dependência deve ficar encapsulada atrás de adapters e o plano deve rever suporte/manutenção antes dessa data e em cada release principal. Se o suporte necessário não puder ser mantido, avaliar migração de implementação sem alterar contratos de domínio.

## Arquitetura alvo

```text
React renderer (UI, React Router, shadcn, Tailwind)
  ├─ features / hooks / contexts / services de domínio compartilháveis
  ├─ Vidstack (player e captions; integração JASSUB somente onde necessária)
  ├─ Playback Controller (contrato de comandos/eventos independente do player)
  ├─ Source Resolver (normalização de formato, MIME e metadados de fonte)
  ├─ Zustand (estado compartilhado; engine continua autoridade sobre estado de mídia ao vivo)
  ├─ adaptadores de armazenamento local (IndexedDB; migração versionada)
  ├─ APIs públicas permitidas (ex.: AniList, se CORS e CSP permitirem)
  └─ bridge tipada e mínima via window.animonkey (preload), somente para
       capacidades privilegiadas realmente necessárias
       └─ IPC validado por canal, origem e payload, se introduzido
            └─ Electron main (janelas, ciclo de vida, protocolo de mídia e
                operações privilegiadas; sem backend improvisado)

APIs remotas confiáveis (auth, Supabase protegido, Anivexa/proxy, PartyKit)
  └─ chamadas HTTPS; segredos de servidor permanecem fora do aplicativo distribuído
```

Regras da fronteira Electron:

- Renderer sem Node.js, sem acesso direto ao filesystem e sem segredos privados. Manter `contextIsolation: true`, `nodeIntegration: false`, sandbox quando compatível, CSP restritiva e validação de origem/payload nos handlers IPC.
- Preload expõe métodos específicos e tipados, nunca `ipcRenderer`, `require` ou uma ponte genérica.
- Processo main é a fronteira para capacidades locais privilegiadas. Não transformar o main em backend improvisado nem embutir `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `NEXTAUTH_SECRET`, `PARTY_ADMIN_TOKEN` ou credenciais Anivexa no app.
- Configuração pública de endpoint pode ser distribuída; qualquer token de usuário deve ser tratado como credencial e armazenado em mecanismo de sistema operacional apropriado, com plano de logout/revogação. O renderer recebe somente o mínimo necessário.
- Serviços de domínio devem depender de interfaces/adaptadores, não de `next/*`, `NextRequest`, `NextResponse` ou APIs específicas do browser sem fallback.

## Inventário de funcionalidades e destino

| Área do app web        | Funcionalidades a preservar                                                                          | Destino / observação                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shell e navegação      | home, layouts, navbar, tema, transições, not-found e erros                                           | Renderer React Router; adaptar links, navegação, erros e rotas dinâmicas.                                                                                                                                                                                                                                                                                                                             |
| Catálogo               | home, trending, recentes, updates, detalhes, recomendações, personagens e metadados                  | Reusar serviços, normalizadores, tipos e componentes após remover dependências Next; navegação e metadata viram recursos de renderer.                                                                                                                                                                                                                                                                 |
| Busca                  | busca de anime, filtros, debounce e histórico                                                        | Busca ampliada com filtros públicos AniList para anime: status/formato incluído ou excluído, temporada/datas, episódios/duração, nota/popularidade, país, fonte, licenciamento, gêneros/tags/categorias, IDs externos, conteúdo adulto e ordenação. Preservar `mediaType: ANIME` e `isAdult`; não expor filtros de lista/favoritos pessoais sem OAuth AniList. Revisão visual runtime segue pendente. |
| Agenda                 | schedule e cache                                                                                     | Reusar serviço/cache, revisar TTL e invalidação sem mudar as chaves silenciosamente.                                                                                                                                                                                                                                                                                                                  |
| Player                 | episódios, seleção de server/source, HLS, DASH, proxy, progresso, VTT/ASS/SSA, JASSUB e preferências | Vidstack é a implementação principal aprovada. Preservar headers, Range, reescrita de BaseURL, worker/WASM e sequência de montagem; verificar captions/legendas por provider e não presumir equivalência para conteúdo hard-sub ou faixas embutidas. Encapsular a biblioteca para permitir evolução futura.                                                                                           |
| Dados locais           | watch-later, continue-watching, histórico/cache e preferências                                       | IndexedDB permanece renderer; versionar esquema, testar upgrade e preservar dados já existentes quando possível.                                                                                                                                                                                                                                                                                      |
| Conta e sync           | cadastro/login/logout, perfil/senha/avatar, ratings, privacidade, export, feed e sync                | NextAuth e seus Route Handlers não existem no Electron. Manter backend HTTPS remoto no início ou extrair backend independente antes de desligar rotas; migração não coloca service role/JWT secret no cliente. Supabase RLS e auth precisam de desenho validado.                                                                                                                                      |
| Watch together         | salas, chat, presença, sync de player e admin de sala                                                | PartyKit segue serviço remoto; adaptar conexão/ciclo de vida, identidade, reconnect e permissões. Nunca incluir token administrativo no bundle.                                                                                                                                                                                                                                                       |
| Admin                  | dashboard, health, rooms                                                                             | Definir se pertence ao produto desktop; preservar acesso e autorização. Painel não substitui autorização server-side.                                                                                                                                                                                                                                                                                 |
| Páginas institucionais | DMCA e termos                                                                                        | Manter como telas locais versionadas ou abrir conteúdo web oficial conforme decisão de produto; não omitir no inventário.                                                                                                                                                                                                                                                                             |
| Recursos web           | sitemap, robots, metadata/SEO, Analytics e Speed Insights                                            | SEO/crawlers não se aplicam da mesma forma ao app desktop; manter site web separado e decidir telemetria desktop com consentimento/configuração compatíveis.                                                                                                                                                                                                                                          |

## Estratégia recomendada

1. **Dois produtos, um domínio:** o site Next continua atendendo web/SEO e serve inicialmente como backend HTTPS para operações que hoje dependem de Route Handlers. O cliente Electron passa a ser outra interface do mesmo domínio.
2. **Extração gradual:** primeiro identificar e isolar lógica pura e contratos compartilháveis; depois avaliar uma biblioteca de domínio comum. Não mover arquivos entre repositórios em massa e não criar dependência do app web sobre Electron.
3. **Compatibilidade por adaptador:** renderer chama interfaces de serviços; adaptadores Electron/web encapsulam persistência, autenticação, navegação e capacidades nativas.
4. **Migração por fatia vertical:** cada fase entrega fluxo completo verificável, comparado com o site. Recursos de alto risco (autenticação, streaming, dados locais e PartyKit) ficam isolados e têm critérios explícitos de regressão.
5. **Site estável:** sem mudança de comportamento ou dependência do site para compilar o desktop. Mudanças no backend/site só quando necessárias e em commits/PRs próprios, retrocompatíveis e acompanhados de validação web.

## Fases e critérios de saída

### Fase 0 — Preparar repositório e baseline

- Confirmar/criar Git para `animonkey-electron`, remotes, branch padrão e origem do starter; preservar seus arquivos atuais.
- Adicionar `AGENTS.md` para arquitetura Electron, limites de segurança, stack/package manager e validações.
- Renomear metadados do app, documentar execução e build, estabelecer baseline de lint/typecheck/Forge e confirmar instalação reproduzível com pnpm (lockfile existente).
- Criar matriz rastreável requisito → issue/fase → evidência, incluindo todas as linhas do inventário deste plano.

**Saída:** repositório rastreado, starter reproduzível e critérios para detectar regressões definidos.

### Fase 1 — Fundação de UI e compatibilidade

- Fixar alias TypeScript/Vite, React Router, tratamento global de erros, carregamento e layout da aplicação.
- Instalar/configurar shadcn/Radix de forma compatível com Tailwind v4; trazer tokens CSS, fontes, ícones e primitivas necessárias preservando licença e origem.
- Criar estrutura no destino para `app` (rotas do renderer), `components/features`, `components/layout`, `components/shared`, `components/ui`, `services`, `lib`, `hooks`, `context`, `types` e `electron` (main/preload), respeitando o starter existente.
- Definir política de links externos, janela, menu, atalhos e deep links sem abrir navegação remota arbitrária dentro da janela privilegiada.

**Saída:** navegação base e design system prontos sem copiar regras Next incompatíveis.

### Fase 2 — Camada de domínio e dados públicos

- Migrar primeiro contratos (`types`), funções puras (`lib`), normalização AniList/Anivexa sem segredo e serviços/cache desacoplados.
- Classificar cada import por ambiente: renderer-safe, main-only, web-only ou precisa de adapter. Remover `next/image`, `next/link`, `next/navigation`, `next/headers`, `server-only`, `process.env` do bundle renderer e `fetch` específico de Route Handler.
- Migrar AniList, home, search, schedule, trending e recentes; conservar adult filtering e a política de cache existente.
- Definir CSP/connect-src e permissões de rede apenas para destinos necessários.

**Saída:** catálogo e navegação de descoberta equivalentes, com estados de erro/offline e cache preservados.

### Fase 3 — Biblioteca do player e streaming

- **Cronograma revisto em 10/11/2026:** por decisão explícita do usuário, Vidstack é o único player; Plyr e código exclusivo já foram removidos antes da validação audiovisual final. Fallback entre fontes/provedores continua dentro do Vidstack, mas nunca troca de engine. Zustand foi introduzido para a seleção compartilhada do servidor ativo, sem armazenar lista de fontes, URLs ou credenciais. Próximos marcos: validar Vidstack e a troca de servidores no pacote/fontes reais; fechar a matriz de captions e registrar limites conhecidos; rodar a validação final do app empacotado e seguir com persistência/distribuição.
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
- **Step de coleta/análise de providers e legendas:** para cada resposta da API, registrar de forma sanitizada provider/server, tipo de stream, audio/sub, `subtitleType`, tracks do stream e do payload, extensão/formato, idioma (`srclang`, `lang`, `label`, `language`), `default`, grupos HLS `EXT-X-MEDIA`, headers exigidos por categoria (sem valores), classificação soft-sub/hard-sub/unknown e como essa classificação foi confirmada. Comparar os metadados com as faixas que o player realmente mostra; não inferir soft-sub só porque a API listou um arquivo. Repetir a coleta em HD-2, HD-1 e H-SUB do Re-anime, Anikoto e Ani.pm e anexar evidência sem segredos à matriz de QA.
- **Step de verificação de captions e marcadores da timeline:** em fontes reais, confirmar que as captions aparecem no tempo correto durante play/pause/seek, troca de episódio, seleção de idioma e fullscreen. Quando a resposta do provider trouxer `intro`/`outro`, confirmar que cada intervalo aparece na timeline do episódio, com limites e rótulos corretos e affordance acessível para saltar; testar marca ausente/inválida, seek manual e troca rápida de episódio para garantir que os marcadores antigos não vazem. Comparar com a referência web usando o mesmo provider, episódio, timestamp e viewport; registrar captura/resultado por combinação validada. Sem metadados de intro/outro numa fonte real, manter esse caso explicitamente pendente em vez de inferir sucesso.

**Saída:** matriz de testes de player cobre HLS proxied/direto/fallback, DASH com segmentos/Range, providers com headers, captions VTT/SRT/SSA/ASS/JSON disponíveis nas fontes e casos JASSUB quando aplicável; falhas em legenda não impedem vídeo. Smoke audiovisual no app empacotado é obrigatório.

#### Decisão Vidstack e manutenção

- **Decisão atualizada em 10/11/2026:** Vidstack é o único player por decisão explícita do usuário. Plyr foi removido como backup antes da validação final; a aplicação não mantém troca automática ou manual para outro engine. Em 11/11/2026, o usuário confirmou o smoke audiovisual do app empacotado; a adoção funcional está `COMPLETED`. `TD-PLAYER-001` segue adiado por decisão do usuário e não faz parte do aceite desta etapa.
- A documentação oficial do Vidstack declara manutenção de segurança apenas para a linha 1.x, com patches prioritários até janeiro de 2028, e direciona o desenvolvimento ativo para Video.js 10. Esse risco foi aceito para o plano atual; isso não significa suporte funcional garantido até essa data.
- Manter contratos de source e Playback Controller independentes da API Vidstack, registrar versão suportada, revisar avisos de segurança/manutenção em cada release e reavaliar biblioteca antes de janeiro de 2028. Uma eventual mudança futura de player deve ser implementada por adapter e não alterar contratos de provider ou dados.
- Vidstack documenta VTT, SRT, SSA/ASS e JSON na biblioteca de captions; SSA/ASS pode ser mapeado para VTT estendido pelo renderizador. Há plugin opcional de libass via JASSUB. Testar estilo, posicionamento, encoding, temporização, troca de track, fullscreen e desempenho com os arquivos/provedores reais; a lista de formatos, sozinha, não comprova paridade visual.
- Compatibilidade React 19/Electron 43 e produção Windows x64 é item de validação deste projeto. A documentação web do Vidstack não é evidência de smoke no Electron empacotado.
- Vidstack permite captions VTT/SRT/SSA/ASS/JSON pelo `Track`. JASSUB/libass não está instalado nem integrado após a remoção do renderer Plyr; reintroduzir somente para casos reais que não atinjam paridade no renderer Vidstack.
- O tamanho das captions Vidstack deve ser controlado pelo seletor nativo em **Acessibilidade → Estilos de legenda → Fonte → Tamanho**, que aplica `--media-user-font-size` sobre `--media-cue-font-size`. Não adicionar escala própria em paralelo. O estilo padrão compartilhado do player mantém texto branco com contorno/sombra escura e sem fundos no display ou nos cues; a CSS do renderer Vidstack padroniza isso para todos os formatos de track, inclusive anulando tamanhos/cores/fundos por formato para que o seletor nativo seja a autoridade visual comum.
- O preset visual segue a preferência confirmada pelo usuário: texto branco, sombra suave, transparência no fundo e tamanho pelo controle nativo. A legenda selecionada automaticamente é apenas PT-BR; quando ela não existe, captions ficam desativadas até seleção manual.
- O seletor de playback tem dois níveis: provedor e subservidores daquele provedor. Os campos de provider e server precisam permanecer separados no contrato; provedores/streams com PT-BR são priorizados, e English aparece depois dentro de cada provedor.
- Débitos observados de captions devem ser registrados em [docs/technical-debt/README.md](./docs/technical-debt/README.md), com evidência, formato/provider ainda que sanitizados, hipótese separada de causa e critério de aceite. `TD-PLAYER-001` registra texto/comandos fora de contexto e quebras de linha; foi deliberadamente adiado para investigação futura.
- O Source Resolver em `src/lib/player-source-resolver.ts` decide proxy/direto/embed permitido e MIME HLS/DASH/MP4 para Vidstack.
- O hook `usePlaybackController` deduplica erros e aplica a sequência proxy → HLS direto sem playlistKey → próximo servidor → embed HTTPS permitido → erro amigável. Não possui o elemento `<video>` nem toma autoridade sobre tempo, estado de captions ou teardown, que continuam no adapter Vidstack.
- Referência de estilo e controles: [Captions — Vidstack](https://vidstack.io/docs/player/components/display/captions/). A seleção de tamanho pertence ao menu de acessibilidade/estilos da layout default, não a um seletor customizado no menu de tracks.
- Referências oficiais: [status do Vidstack](https://vidstack.io/docs/player/), [formatos e carregamento de captions](https://vidstack.io/docs/player/core-concepts/loading/) e [integração opcional JASSUB](https://vidstack.io/docs/player/core-concepts/loading/).

#### Verificações atuais de faixa e elegibilidade

> Esta subseção registra o comportamento observado no player legado Plyr e serve de baseline de comparação; não define automaticamente a implementação de captions no Vidstack.

- O adapter procura idioma nos campos `srclang`, `lang`, `label` e `language`, tanto em tracks do stream quanto do payload, e normaliza apenas português (incluindo PT-BR) e inglês para os badges atuais.
- Tracks duplicadas pelo mesmo URL são consolidadas. O formato ASS/SSA é reconhecido pela extensão no pathname da URL. No player, `filterSubtitles` mantém apenas captions com idioma conhecido (PT-BR/EN) e no máximo uma faixa por idioma.
- Antes desta etapa, fonte sem idioma detectado era descartada salvo título adulto/Hentai. Agora `subtitleType: hardsub` explícito também mantém a fonte e a identifica como embutida; `softsub` com tracks segue selecionável. `unknown` não é uma confirmação visual de nenhum dos dois casos.
- Limitação a resolver no step de coleta: metadados podem omitir idioma/extensão ou declarar softsub/hardsub incorretamente, e HLS pode anunciar captions no próprio manifesto. Comparar API, playlist, menu real e imagem de vídeo antes de alterar filtros. O tamanho customizado se aplica a WebVTT via Plyr e a ASS/SSA via escala de estilos/tags; não altera legenda já queimada no vídeo.

### Fase 4 — Persistência e experiência offline

- Reusar IndexedDB no renderer quando viável; verificar segurança de origem/storage no Electron, migrações de schema, quota, limpeza e recuperação.
- O cache público do catálogo mantém registros vencidos para fallback offline por até 30 dias após o TTL; a limpeza deve preservar esse período e remover os registros antigos gradualmente quando novas consultas forem gravadas.
- Preservar `watch-later`, histórico, continue-watching, preferências e cache público; não conflitar stores de dados privados com cache de catálogo.
- Implementar export/backup local e política de migração dos dados web: não assumir que IndexedDB do Chromium do site é visível ao app desktop; oferecer importação explícita se desejado.
- Tratar o conteúdo do backup importado como entrada não confiável e validar o esquema e os campos aninhados antes de iniciar qualquer gravação; mesclar em uma transação para evitar importação parcial.
- Manter os princípios offline-first e LWW para dados do usuário e validar troca de conta sem vazamento de dados entre perfis.

**Saída:** dados sobrevivem restart/upgrade; operações offline, reconcile, conflito, troca de conta e recuperação de falha são verificáveis.

### Fase 5 — Conta, autenticação e sincronização

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

**Saída:** fluxos de usuário anônimo e autenticado, sessão expirada, revogação/logout, políticas RLS, reconcile e atualização do site funcionam sem credencial privada no pacote. Troca de senha, perfil, avatar, export, privacidade, feed e sync foram publicados no `desktop-api`; smoke remoto descartável confirmou operações e limpeza integral dos registros temporários.

### Fase 6 — Watch together e recursos complementares

- Adaptar PartyKit (salas, chat, presença, sincronização, reconnect) ao ciclo de vida Electron; testar suspensão/retomada da máquina, perda de rede e janela fechada.
- Preservar authorization do servidor e ferramentas administrativas sem distribuir `PARTY_ADMIN_TOKEN`.
- Migrar admin, termos/DMCA e comportamentos auxiliares explicitamente, conforme a matriz; decidir notificações, deep links e atalhos como recursos desktop incrementais.

**Saída:** cada item do inventário tem status migrado, substituído com equivalência aprovada ou decisão de produto registrada; nada desaparece por acidente.

### Fase 7 — Endurecimento e distribuição

- Rever Electron security checklist: permissões, navegação, IPC, CSP, fuses, atualização, logs sem credenciais, armazenamento de tokens e limpeza de dados.
- Conferir licenças e notices das dependências novas e distribuídas, especialmente player/JASSUB, codecs e fontes.
- Produzir instaladores Windows/macOS/Linux conforme escopo, assinatura/notarização quando disponível, atualização segura, desinstalação e recuperação.
- Fazer smoke test em instalação limpa e upgrade; testar escala HiDPI, teclado, múltiplas janelas se suportadas, performance e consumo de memória.

**Saída:** pacotes assinados ou limitações de assinatura explícitas, matriz de plataformas aprovada e plano de release/rollback.

### Fase 8 — Paridade visual e QA lado a lado

- Aplicar este gate a todas as páginas migradas; comparar a referência do app web com o Electron no mesmo tamanho de janela e estado de conteúdo.
- Retomar esta avaliação como revisão geral do site, página por página. Para cada rota migrada, alinhar viewport, dados, conta, scroll e estado de carregamento/erro; comparar estrutura, espaçamento, tipografia, imagens e interações, registrar diferenças e evidência, corrigir e conferir de novo antes de aprovar a página. Não declarar paridade do site com base em amostras de poucas rotas.
- Exigir paridade visual total nas páginas de informações do anime e player: hierarquia, banner/poster, tipografia, espaçamentos, botões, tabs/listas, proporções do vídeo, seletores de episódio/servidor, captions e estados loading/erro/vazio.
- No player, incluir as captions sincronizadas com a mídia e os marcadores clicáveis de intro/outro na timeline do episódio quando existirem timestamps válidos do provider; confirmar que mudam corretamente ao trocar o episódio.
- Confirmar que as rotas ocupam a área útil completa entre sidebar e topbar, sem max-width/margem global que comprima o conteúdo; componentes internos podem manter gutters próprios. Páginas de detalhe não devem ganhar moldura externa sem existir na referência.
- Testar imagens remotas na build empacotada. A CSP deve permitir somente origens públicas necessárias e derivar a origem Supabase da URL pública configurada; verificar renderização de avatar, posters e thumbs.
- Registrar rota, viewport, estado comparado, diferenças encontradas e evidência visual; corrigir diferenças antes de marcar cada rota como paridade completa.

**Verificação inicial em 11/11/2026:** comparação de `/anime/159042` e `/watch/159042` no site local e no Electron. As janelas não estavam no mesmo viewport (Chrome 1520×900; Electron 1426×912), então esta rodada identifica diferenças, mas não é aceite final. No detalhe, o legado apresenta poster/título nativo e inglês, ações, e abas Episódios/Personagens/Relações; o Electron tinha personagens e recomendações, mas não mostrava os episódios nem as abas. A lista por abas foi adicionada ao Electron usando os episódios da Anivexa; requer conferência visual no mesmo viewport. No player, os dois runtimes exibiram “nenhum servidor disponível”; o estado vazio de vídeo e a composição não permitem concluir paridade audiovisual ou de controles. Ambas as rotas seguem `IN_PROGRESS` até comparação pareada de estados carregado, reprodução e erro.

**Inventário estático comparativo em 11/11/2026:** leitura dos layouts, rotas e componentes principais nos dois repositórios. É um mapa de disparidades de implementação; não substitui inspeção de runtime. A fonte global Rubik do legado estava divergente do Inter do Electron, inclusive no Vidstack. O Electron agora usa arquivos Rubik locais (latin/latin-ext) para não depender da rede no app empacotado. O shell Electron permanece intencionalmente adaptado a desktop (sidebar e topbar), enquanto cores/tokens, tipografia, espaçamento interno e componentes de cada rota devem ser comparados por página.

**Comparação visual inicial da Home em 11/11/2026:** Chrome (`http://localhost:3000`) e Electron (`http://localhost:5174`) foram observados maximizados no mesmo viewport de 1920×1080. As capturas foram feitas uma janela por vez, não lado a lado simultaneamente. A sidebar do Electron foi mantida por decisão do usuário. Diferenças visíveis: a navegação web é uma faixa sobre o hero; no Electron, a navegação ocupa sidebar permanente e a busca fica na barra superior. O hero web usa quase toda a primeira dobra, enquanto no Electron termina perto do início das fileiras de catálogo; o web mostra a seção “Continuar Assistindo” logo após o hero, que não aparece nessa posição no Electron. O conteúdo Electron começa à direita da sidebar e exibe mais cards por fileira. Os estados não estavam totalmente pareados: usuário conectado no Electron e desconectado no Chrome; idioma/título selecionado também variou com o carrossel. Portanto, os achados da Home são diagnóstico, não aceite final. Solicitação de UX: manter a sidebar; avaliar busca flutuante ou ocultação ao rolar para baixo, reaparecendo ao rolar para cima.

| Página/área                          | Referência web                                                                                           | Estado e disparidade conhecida no Electron                                                                                                                                                                                                  | Próxima verificação visual                                                                                                          |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Shell e navegação                    | Navbar superior responsiva, transição de página e footer                                                 | Sidebar + topbar desktop; adaptação deliberada. Rubik corrigida nesta etapa. Tokens diferem (`#111111`/`#2caf57` no legado contra `#0b0b0c`/`#49d77a` no Electron); altura do header, gutters e janela menor ainda precisam ser comparados. | Mesma resolução útil; conferir menu, foco, scroll, gutters e conteúdo até as bordas.                                                |
| Home                                 | Hero, continuar assistindo, assistir depois, atualizações, tendências e agenda lateral                   | Hero e composição próprios; listas/agenda diferentes, e continuar/assistir depois ficam em rotas próprias em vez de ocupar a Home.                                                                                                          | Comparar dobra inicial e rolagem completa; registrar ordem, proporções e estados vazios.                                            |
| Busca                                | Breadcrumb, filtros laterais, cards animados e paginação                                                 | Filtros aplicáveis ao catálogo de anime no topo/expansão; URL preserva critérios/paginação; gêneros e tags são carregados do AniList. Grid adaptado ao Electron.                                                                            | Comparar filtros, cards, paginação, carregamento e layout no mesmo viewport; revisão runtime visual PENDENTE.                       |
| Tendências e atualizações            | Páginas dedicadas para Em alta e Lançamentos; abas locais para completos e recém adicionados na Home     | Rotas dedicadas só para `trending` e `updates`; abas da Home exibem completos/recém adicionados, sem telas redundantes na sidebar.                                                                                                          | Conferir as duas páginas dedicadas e validar que as abas da Home continuam alternando coleções.                                     |
| Informações do anime                 | Hero/banner, poster, título/idioma, ações, tabs Episódios/Personagens/Relações, recomendados e avaliação | Tabs e episódios migrados; organização do hero, metadados, espaçamento e estados ainda diferem ou aguardam conferência lado a lado. Avaliação deve permanecer abaixo dos relacionados/recomendações conforme ajuste solicitado.             | Prioridade máxima: mesmo anime, viewport, scroll e estado; verificar poster/banner, tabs, ações, relacionados e formulário de nota. |
| Player                               | Player e lista de episódios/servidores, informações e navegação contextual                               | Fluxo Vidstack migrado, composição desktop própria. Paridade visual/audiovisual não aprovada. QA de captions sincronizadas e marcadores intro/outro dependem de fonte/timestamps reais.                                                     | Prioridade máxima: estado vazio, reprodução, troca de episódio/fonte, captions e timeline com timestamps.                           |
| Agenda                               | Calendário semanal/diário e alternância de idioma do título                                              | Seletor de data e cards em composição diferente.                                                                                                                                                                                            | Igualar data/horário e títulos; comparar navegação e densidade da lista.                                                            |
| Conta e configurações                | Hub de conta com estatísticas e tabs de biblioteca; configurações separadas                              | Autenticação/conta ficam em Settings; biblioteca em rotas dedicadas. Funções migradas, arquitetura visual diferente.                                                                                                                        | Comparar identidade, sessão, avatar, estatísticas, formulários, feedback e estados sem rede.                                        |
| Assistir depois / continuar          | Tabs dentro do hub da conta e módulos na Home                                                            | Rotas próprias. Conferir consistência de cards, remoção, progresso e estados vazios.                                                                                                                                                        | Comparar listas com conta e biblioteca equivalentes.                                                                                |
| Feed de atividade                    | Cards com avatar, poster e título do anime                                                               | Feed/sync e evento `episode_completed` implementados; Electron ainda exibe `Anime #<id>` sem resolver título/poster como o legado. Avatar no cabeçalho foi conferido, mas no card não tem aceite visual.                                    | Gerar atividade real e comparar avatar, título/poster, timestamp, paginação e opt-in.                                               |
| Login/registro                       | Rotas próprias                                                                                           | Ações integradas em Settings; rota web separada não tem destino visual dedicado no Electron.                                                                                                                                                | Avaliar se o fluxo em Settings é claro e completo, incluindo erro e sessão persistida.                                              |
| DMCA, termos, admin e Watch Together | Rotas presentes no legado                                                                                | Não há equivalentes completos; Watch Together e complementos continuam `NOT_STARTED`/adiados.                                                                                                                                               | Classificar escopo de migração antes de planejar paridade; não contar como rota visual concluída.                                   |

**Escopo desta rodada:** leitura de código e registro das diferenças; a revisão visual página por página continua pendente. Nenhuma rota fica aprovada por esta inspeção estática. A comparação deverá guardar viewport, rota, dados/conta, scroll, estado visual e evidência.

**Implementação da Home Electron em 11/11/2026:** composição portada conforme `components/features/home/home-content.tsx` do legado: hero com banners rotativos, ações assistir/assistir depois, continuar assistindo com posição do episódio, lista Assistir Depois, fileira de atualizações, tabs de catálogo e agenda lateral. A sidebar desktop foi preservada conforme decisão do usuário. A busca global fica centralizada no header, recolhe ao rolar para baixo e retorna ao rolar para cima; é omitida em `/search`, onde a página já oferece busca. O seletor de títulos EN/JP foi restaurado e ligado às telas migradas. Isso conclui implementação estática desta fatia, mas não seu aceite visual: ainda validar Home em estados/idiomas pareados e rolagem completa; em seguida comparar Anime e Player na mesma resolução, incluindo reprodução e marcadores temporais reais.

**Ajustes transversais da UI em 11/11/2026:** trilhos da Home adotaram carrossel horizontal reutilizável com setas, rolagem por gesto/trackpad e teclado, e barra visualmente oculta. O shell agora centraliza e aplica padding responsivo em Search, Catálogos, Agenda, Biblioteca, Feed e Configurações; Home já possui seu frame próprio. Anime e Player permanecem sem frame externo, conforme exceções definidas. Schedule recebeu navegação por semana/dia, estado da data selecionada e cards responsivos com capa, horário e episódio. TypeScript, ESLint e Prettier passam. A janela Electron mais recente está em `/recent?page=2`; a inspeção visual específica de Home/Schedule e dos carrosséis continua pendente.

**Refino do banner da Home em 11/11/2026:** a arte panorâmica preenche o hero usando `object-cover`, preservando a proporção e cortando uniformemente as laterais necessárias; `object-position` prioriza a região central. Poster de fallback usa foco elevado. Gradientes direcionais e sombra interna mantêm a leitura do texto. A validação visual no runtime ainda deve conferir diferentes banners e o fallback de poster.

**Conferência nativa da Home em 11/11/2026:** janela Electron 1920×1032, rota `/`, captura após o refino mostrou imagem cobrindo o hero sem a faixa estreita vista anteriormente; título, descrição e ações permanecem legíveis. Esta é uma conferência isolada do Electron, não comparação com o site legado. A Agenda é a próxima rota da rodada; a interação nativa pediu refresh do estado antes de mudar de tela e ficou pendente.

**Simplificação da navegação em 11/11/2026:** removidas as entradas de sidebar “Mais populares”, “Concluídos” e “Adicionados recentemente” e suas rotas dedicadas (`/popular`, `/completed`, `/recent`). As coleções concluídos e recém adicionados continuam acessíveis pelas abas da Home; “Em alta” permanece em Trending. Rotas removidas caem no redirecionamento geral para Home.

**Próxima revisão visual:** avaliação geral página por página de todas as rotas migradas, conforme pedido do usuário em 11/11/2026. A avaliação anterior foi apenas uma inspeção diagnóstica de anime/player e não substitui essa rodada. O step de captions e marcadores intro/outro também está pendente de validação com timestamps/fontes reais.

**Saída:** matriz visual por rota com evidência lado a lado; player e informações do anime aprovados em paridade visual total no app empacotado.

## Critérios de estabilidade e acompanhamento

- Usar estados rastreáveis `NOT_STARTED`, `IN_PROGRESS`, `BLOCKED`, `COMPLETED` e `CANCELLED`. `COMPLETED` exige critérios de aceite atendidos e validações executadas; se uma validação necessária não puder ser feita, registrar a limitação e manter a etapa incompleta.
- Ao concluir cada etapa, registrar escopo e arquivos/módulos, decisões, testes e resultados, riscos/bloqueios, desvios e próximas tarefas em `MIGRATION_PROGRESS.md`; preservar entradas históricas existentes.
- A matriz funcional é a fonte de verdade para paridade. Cada item registra status (`não iniciado`, `em progresso`, `migrado`, `bloqueado`, `decisão de produto`), evidência e riscos.
- Toda fatia deve compilar, passar typecheck/lint e ter testes proporcionais: unitários para normalizadores/regras, integração para IPC/adaptadores e smoke/E2E para fluxos de UI críticos. Não declarar paridade somente por build verde.
- Em cada release candidata, comparar cenários equivalentes nos dois apps e verificar que o `animonkey` web continua buildável e utilizável. Mudanças inevitáveis no backend devem manter contratos web retrocompatíveis.
- Preservar dados: nenhuma migração de IndexedDB/cache ou formato de progresso é feita sem versão, backup/estratégia de recuperação e teste de upgrade.
- Não fazer cutover ou encerrar o site/backend Next até todos os clientes e serviços consumidores terem migrado e os dados/contratos estarem validados.

### Critérios adicionais de aceite da modernização

- Vidstack está encapsulado pelo Playback Controller, integrado ao Zustand sem duplicação de autoridade e consegue trocar source/engine e limpar listeners/recursos no ciclo de vida correto.
- Source Resolver preserva formatos, MIME types, legendas e metadados necessários; HLS/DASH mantêm o proxy, headers, autenticação, Range e reescritas exigidas por provider.
- Captions VTT, SRT, SSA/ASS e JSON são verificadas com fixtures/fontes representativas; integração JASSUB só é considerada aprovada após validação visual e de ciclo de vida quando necessária.
- IPC introduzido tem contratos compartilhados, canais permitidos, validação de origem/payload, erros padronizados, unsubscribe e timeout/cancelamento quando aplicável. Se nenhuma capacidade privilegiada nova precisar de IPC, manter a bridge mínima existente e registrar essa decisão.
- Service Manager só é implementado para serviços/processos que o app efetivamente precise iniciar ou supervisionar; chamadas HTTP remotas não justificam, por si, um gerenciador de processos.
- Build e smoke empacotados Windows x64 aprovados para reprodução, troca de episódio/provider, controles, captions, erros e encerramento; os formatos sem evidência continuam pendentes.

## Decisões pendentes antes das fases dependentes

1. O site Next continuará publicado como produto web e backend de compatibilidade? **Recomendação: sim.**
2. Qual o backend definitivo para autenticação e proxy Anivexa: endpoints Next existentes, serviço separado ou API da Anivexa ampliada?
3. Quais sistemas operacionais e canais de update são alvo do primeiro release?
4. Deve haver importação explícita de dados do browser e perfil local ou perfil único desktop?
5. Admin, Analytics, Speed Insights, termos/DMCA e notificações devem ter equivalência desktop literal ou adaptação de produto?

As decisões acima não bloqueiam a fundação visual nem a migração inicial de catálogo. Elas bloqueiam qualquer remoção de endpoints Next ou distribuição de funcionalidades que dependam de segredos server-side.

## Referências do repositório web

- [AGENTS.md](../animonkey/AGENTS.md) — arquitetura, integrações e fluxo de trabalho do site.
- [CLAUDE.md](../animonkey/CLAUDE.md) — convenções atuais de frontend; regras específicas de Next devem ser reinterpretadas para o renderer Electron, não copiadas literalmente.
- [docs/README.md](../animonkey/docs/README.md) — índice de documentação.
- [docs/implementation-progress.md](../animonkey/docs/implementation-progress.md) — estado da implementação Auth + Sync.
- [docs/sync-architecture.md](../animonkey/docs/sync-architecture.md) — IndexedDB, Supabase, reconcile e LWW.
- [docs/provider-streaming.md](../animonkey/docs/provider-streaming.md) e [docs/player-subtitles.md](../animonkey/docs/player-subtitles.md) — contratos e restrições do player.
- [docs/env-variables.md](../animonkey/docs/env-variables.md), [docs/nextauth-setup.md](../animonkey/docs/nextauth-setup.md), [docs/supabase-setup.md](../animonkey/docs/supabase-setup.md) e [docs/database-schema.md](../animonkey/docs/database-schema.md) — segredos, auth e dados remotos.
