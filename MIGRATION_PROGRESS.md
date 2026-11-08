# Progresso da migração

Este tracker acompanha [MIGRATION_PLAN.md](./MIGRATION_PLAN.md). Estado atualizado em 08/11/2026.

| Fase                              | Estado       | Evidência / próximo passo                                                                                                                                                                                                                                                            |
| --------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0 — Repositório e baseline        | Concluída    | `main` acompanha `origin/main` (`DaniHRE/animonkey-electron`); `AGENTS.md`, scripts, identidade do app e baseline de validação configurados. Sem commits/push nesta migração.                                                                                                        |
| 1 — Fundação UI e compatibilidade | Parcial      | HashRouter, shell desktop, alias, Tailwind 4, primitiva shadcn, error boundary global, skip link e CSP derivada da URL pública. Faltam outras primitivas e QA de acessibilidade.                                                                                                     |
| 2 — Domínio e dados públicos      | Parcial      | Home, busca AniList paginada com ANIME/adult e filtros, detalhes enriquecidos, catálogo e agenda; cache IndexedDB com TTL e fallback expirado. Falta revisar paridade completa e otimizar o cache.                                                                                   |
| 3 — Player e streaming            | Parcial      | Episódios/fontes reais via Anivexa; proxy no main para HLS/DASH, Range e redirects; Plyr/HLS.js/dash.js/JASSUB; avanço automático entre servidores e erro de renderização contido no quadro. Erros de rede/provedor agora exibem orientação amigável. Falta QA audiovisual completo. |
| 4 — Persistência offline          | Parcial      | IndexedDB schema v3 com Assistir Depois, cache, progresso e preferências; Continue Watching e backup JSON validado com merge por timestamp. Smoke confirma tela de configurações e exportação; falta importar/restaurar e testar upgrade.                                            |
| 5 — Conta e sync                  | Não iniciado | Definir integração HTTPS compatível com NextAuth/Supabase sem credenciais privadas no app.                                                                                                                                                                                           |
| 6 — Watch Together e complementos | Não iniciado | Adaptar PartyKit, feed/admin e páginas institucionais; revisar todo inventário de paridade.                                                                                                                                                                                          |
| 7 — Distribuição                  | Parcial      | `pnpm package` produziu pacote Windows x64. Sem instalador/release, assinatura, atualização ou QA de outras plataformas.                                                                                                                                                             |

## Entregue até aqui

- Configuração local de Git/arquitetura e comandos, preservando o repo web.
- Janela Electron isolada: context isolation, sandbox, Node desativado no renderer, CSP, bloqueio de navegação e abertura externa limitada.
- Shell desktop, React Router, configuração inicial do shadcn e componente Button.
- Serviço AniList com timeout, abort, erros tipados e o mesmo contrato ANIME/adult da busca web.
- Home (trending, lançamentos, recentes, concluídos e agenda), busca com paginação/filtros persistidos na URL, coleções e detalhes com personagens, relações, recomendações, trailer YouTube e próxima estreia.
- Player Anivexa com episódios por provedor, troca de servidor, protocolo proxy local, HLS/DASH, legendas WebVTT/ASS/SSA, JASSUB, skip de intro/outro e retomada de posição.
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
- O pacote usa worker ES para o build Vite/JASSUB.
- 08/11/2026: `pnpm typecheck`, `pnpm lint`, `pnpm format:check` e `git diff --check` passaram após sanitizar mensagens de erro no catálogo/episódios. O detalhe técnico permanece como `cause` interno e não é renderizado na UI.
- Smoke em desenvolvimento em 08/11/2026: catálogo/home, detalhes de anime e configurações locais renderizaram no Electron. A automação da janela não chegou à reprodução nesta execução; o estado audiovisual continua pendente.

## Próximos passos

1. Fazer QA audiovisual empacotado para providers, HLS/DASH, Range, VTT e ASS/SSA; validar JASSUB e fallbacks reais. A troca automática evita manter o usuário no servidor que devolveu erro, mas reprodução completa ainda não está confirmada.
2. Confirmar endpoint Anivexa HTTPS para release; desenvolvimento foi conferido com `http://localhost:4000`.
3. Testar evolução do IndexedDB, importação/restauração do backup e retomada completa pelo player. A exportação foi exercitada no app empacotado, sem gravar por cima do arquivo já existente em Downloads.
4. Fases 5+ seguem separadas: autenticação/sync, feed/admin e Watch Together.

## Commits por etapa

- `b49d82e feat: migrate catalog and player workflows to Electron` — base de catálogo/player e erros voltados ao usuário; `pnpm typecheck`, `pnpm lint`, `pnpm format:check` e `git diff --check` aprovados.
- `e091ae9 docs: record migration smoke status` — smoke em desenvolvimento documentado; catálogo, detalhes e configurações locais renderizaram. A reprodução audiovisual ficou sem confirmação.
- A regra explícita para não usar controle visual sem solicitação e aprovação do usuário será registrada em commit documental separado; seu hash entra no tracker na próxima etapa.
