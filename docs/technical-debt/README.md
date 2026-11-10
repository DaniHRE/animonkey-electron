# Débitos técnicos

Registro de problemas conhecidos que foram observados e devem ser reutilizados na priorização e nas correções futuras. Uma hipótese técnica não é tratada como causa confirmada até ser reproduzida.

## TD-PLAYER-001 — Artefatos e quebras de linha nas captions

- **Estado:** catalogado; correção adiada conforme decisão do usuário.
- **Área:** player / renderização de captions Vidstack.
- **Evidência:** [captura anexada](./TD-PLAYER-001-caption-artifacts.png), observada em _Overgeared_, episódio 2, próximo de 21:28.
- **Comportamento observado:** durante a fala normal surgem quebras de linha e texto fora de contexto, incluindo sequências parecidas com instruções de desenho (`m 1 l 245 ...`) e descrições longas de itens. O texto aparece sobre a imagem como caption.
- **Resultado esperado:** exibir somente o conteúdo temporizado da legenda, sem comandos de desenho, metadados ou mensagens fora de contexto; quebras de linha devem respeitar o cue e a composição legível.
- **Causa:** desconhecida. Possibilidades para investigar incluem parser/normalização de SSA/ASS, comandos de desenho ASS expostos como texto, cues com estilos/posicionamento incompatíveis ou track selecionada incorretamente. A captura não confirma qual formato originou o artefato.
- **Próxima investigação:** registrar provider e formato da track sem expor URLs assinadas; obter o arquivo/trecho de caption sanitizado; comparar o mesmo instante no parser padrão Vidstack e, se o problema for específico de SSA/ASS, testar JASSUB/libass. Verificar também se a mensagem existe no arquivo fonte ou é gerada pelo renderer.
- **Aceite da correção:** reprodução documentada, causa isolada e teste com fixture representativa; nenhum comando/metadado aparece como texto, as quebras de linha ficam corretas e os demais formatos continuam funcionais.
