# Plano de migração — Animonkey para Electron

## Objetivo e princípio de segurança

Migrar a experiência do `animonkey` (Next.js 16, React 19, TypeScript, Tailwind CSS 4 e shadcn/Radix) para o starter `animonkey-electron` (Electron Forge, Vite, React 19 e TypeScript), mantendo todas as funcionalidades existentes e sem interromper nem reestruturar o repositório web durante a migração.

O repositório web continua sendo a referência funcional e uma aplicação independente. A migração ocorre no repositório Electron por fatias verticais, com inventário e critérios de aceite por funcionalidade. Nenhuma feature é considerada migrada apenas por ter sua tela copiada: seus estados, fluxos, persistência, erros, acessibilidade e integrações também precisam funcionar.

## Estado observado

- `animonkey` tem App Router com páginas de catálogo, busca, agenda, anime, player, conta, feed, admin e watch-together; Route Handlers de autenticação, dados, streaming e proxy; serviços, hooks, contexts, caches IndexedDB, workers e servidor PartyKit.
- A base inclui AniList GraphQL, Anivexa, Supabase/NextAuth, sync offline-first, HLS, MPEG-DASH, WebVTT, ASS/SSA/JASSUB e sincronização social via PartyKit.
- No início da migração, `animonkey-electron` era o starter: `src/app.tsx`, `src/main.ts`, `src/preload.ts`, `src/renderer.ts`, Vite separado por processo e Tailwind 4. O trabalho inicial já adicionou React Router, configuração shadcn, shell e features de catálogo; player e integrações de usuário seguem pendentes.
- O destino agora tem controle Git local na branch `main`, acompanhando `origin/main` em `https://github.com/DaniHRE/animonkey-electron`; foi adicionado `AGENTS.md` local de arquitetura e segurança. O plano não pressupõe alterações no histórico do repo web.

## Arquitetura alvo

```text
React renderer (UI, React Router, shadcn, Tailwind)
  ├─ features / hooks / contexts / services de domínio compartilháveis
  ├─ adaptadores de armazenamento local (IndexedDB; migração versionada)
  ├─ APIs públicas permitidas (ex.: AniList, se CORS e CSP permitirem)
  └─ bridge tipada e mínima via window.animonkey (preload)
       └─ IPC validado por canal e payload
            └─ Electron main (janelas, ciclo de vida, storage de segredos,
                filesystem seletivo, atualização, protocolo e operações privilegiadas)

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

| Área do app web        | Funcionalidades a preservar                                                                          | Destino / observação                                                                                                                                                                                                                                             |
| ---------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shell e navegação      | home, layouts, navbar, tema, transições, not-found e erros                                           | Renderer React Router; adaptar links, navegação, erros e rotas dinâmicas.                                                                                                                                                                                        |
| Catálogo               | home, trending, recentes, updates, detalhes, recomendações, personagens e metadados                  | Reusar serviços, normalizadores, tipos e componentes após remover dependências Next; navegação e metadata viram recursos de renderer.                                                                                                                            |
| Busca                  | busca de anime, filtros, debounce e histórico                                                        | Preservar `mediaType: ANIME` e `isAdult`; validar comportamento de API/CORS e mover acesso HTTP para serviços.                                                                                                                                                   |
| Agenda                 | schedule e cache                                                                                     | Reusar serviço/cache, revisar TTL e invalidação sem mudar as chaves silenciosamente.                                                                                                                                                                             |
| Player                 | episódios, seleção de server/source, HLS, DASH, proxy, progresso, VTT/ASS/SSA, JASSUB e preferências | Migração própria de maior risco; preservar headers, Range, reescrita de BaseURL, worker/WASM e sequência de montagem documentada. Não substituir formatos por conveniência.                                                                                      |
| Dados locais           | watch-later, continue-watching, histórico/cache e preferências                                       | IndexedDB permanece renderer; versionar esquema, testar upgrade e preservar dados já existentes quando possível.                                                                                                                                                 |
| Conta e sync           | cadastro/login/logout, perfil/senha/avatar, ratings, privacidade, export, feed e sync                | NextAuth e seus Route Handlers não existem no Electron. Manter backend HTTPS remoto no início ou extrair backend independente antes de desligar rotas; migração não coloca service role/JWT secret no cliente. Supabase RLS e auth precisam de desenho validado. |
| Watch together         | salas, chat, presença, sync de player e admin de sala                                                | PartyKit segue serviço remoto; adaptar conexão/ciclo de vida, identidade, reconnect e permissões. Nunca incluir token administrativo no bundle.                                                                                                                  |
| Admin                  | dashboard, health, rooms                                                                             | Definir se pertence ao produto desktop; preservar acesso e autorização. Painel não substitui autorização server-side.                                                                                                                                            |
| Páginas institucionais | DMCA e termos                                                                                        | Manter como telas locais versionadas ou abrir conteúdo web oficial conforme decisão de produto; não omitir no inventário.                                                                                                                                        |
| Recursos web           | sitemap, robots, metadata/SEO, Analytics e Speed Insights                                            | SEO/crawlers não se aplicam da mesma forma ao app desktop; manter site web separado e decidir telemetria desktop com consentimento/configuração compatíveis.                                                                                                     |

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

- Isolar player e dependências (Plyr, HLS.js, dash.js, JASSUB/WASM/Workers) no renderer; configurar assets de build e caminhos de produção.
- Implementar a estratégia de acesso ao provider: backend/proxy HTTPS existente no primeiro corte; preservar Referer, Authorization, Range, token/chave de manifesto, segmentos e fallback. Não assumir que CORS permite chamada direta nem que URL de embed substitui HLS/DASH.
- Adaptar protocolo de mídia/URLs e testar as mesmas fontes, troca de episódio, troca de servidor, retomar progresso, captions VTT e renderização ASS/SSA.
- Preservar a preparação ASS antes do HLS, o ciclo destroy do JASSUB, worker/WASM no Forge e todas as restrições descritas em `docs/player-subtitles.md` e `docs/provider-streaming.md`.

**Saída:** matriz de testes de player cobre HLS proxied/direto/fallback, DASH com segmentos/Range, providers com headers, VTT e ASS/SSA; falhas em legenda não impedem vídeo.

### Fase 4 — Persistência e experiência offline

- Reusar IndexedDB no renderer quando viável; verificar segurança de origem/storage no Electron, migrações de schema, quota, limpeza e recuperação.
- Preservar `watch-later`, histórico, continue-watching, preferências e cache público; não conflitar stores de dados privados com cache de catálogo.
- Implementar export/backup local e política de migração dos dados web: não assumir que IndexedDB do Chromium do site é visível ao app desktop; oferecer importação explícita se desejado.
- Manter os princípios offline-first e LWW para dados do usuário e validar troca de conta sem vazamento de dados entre perfis.

**Saída:** dados sobrevivem restart/upgrade; operações offline, reconcile, conflito, troca de conta e recuperação de falha são verificáveis.

### Fase 5 — Conta, autenticação e sincronização

- Antes da UI, decidir o backend final. A recomendação é manter temporariamente os endpoints Next em serviço HTTPS independente do ciclo de vida desktop e depois extrair auth/API para backend próprio.
- Redesenhar autenticação nativa para OAuth/deep-link ou fluxo web seguro conforme o backend suportar. NextAuth Credentials/cookies e adapter atuais não são automaticamente compatíveis com renderer Electron.
- Nunca incluir chaves service-role/JWT de Supabase ou segredo de NextAuth no desktop; não permitir que renderer escolha user_id. Fazer operações privilegiadas e validação de ownership no servidor, mantendo RLS.
- Migrar conta, configurações, avatar, export, watch-later remoto, progresso, ratings, privacidade e feed; preservar retry e mensagens de falha sem bloquear o modo offline.

**Saída:** fluxos de usuário anônimo e autenticado, sessão expirada, revogação/logout, políticas RLS, reconcile e atualização do site funcionam sem credencial privada no pacote.

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

## Critérios de estabilidade e acompanhamento

- A matriz funcional é a fonte de verdade para paridade. Cada item registra status (`não iniciado`, `em progresso`, `migrado`, `bloqueado`, `decisão de produto`), evidência e riscos.
- Toda fatia deve compilar, passar typecheck/lint e ter testes proporcionais: unitários para normalizadores/regras, integração para IPC/adaptadores e smoke/E2E para fluxos de UI críticos. Não declarar paridade somente por build verde.
- Em cada release candidata, comparar cenários equivalentes nos dois apps e verificar que o `animonkey` web continua buildável e utilizável. Mudanças inevitáveis no backend devem manter contratos web retrocompatíveis.
- Preservar dados: nenhuma migração de IndexedDB/cache ou formato de progresso é feita sem versão, backup/estratégia de recuperação e teste de upgrade.
- Não fazer cutover ou encerrar o site/backend Next até todos os clientes e serviços consumidores terem migrado e os dados/contratos estarem validados.

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
