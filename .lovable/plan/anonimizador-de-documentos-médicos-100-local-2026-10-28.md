# Anonimizador de Documentos Médicos (100% local)

## Objetivo
Um app web que roda inteiramente no navegador do usuário (sem enviar nada para a internet). A pessoa envia um PDF, foto de exame ou texto de prontuário, o app detecta dados identificáveis, a pessoa revisa, e é gerado um novo PDF anonimizado, pronto para enviar a uma LLM.

## Fluxo do usuário
1. **Enviar** – arrastar PDF, foto (JPG/PNG) ou colar texto do prontuário.
2. **Ler** – o app extrai o texto (PDF com texto direto; foto/PDF escaneado via OCR em português, local).
3. **Detectar** – marca automaticamente:
   - Nome do paciente e do médico
   - CPF, RG, CNS (cartão SUS), nº de convênio/prontuário
   - CRM/COREN e assinaturas
   - Endereço, CEP, telefone, e-mail
   - Nome e logo do hospital/clínica
4. **Revisar** – visualização da página com as áreas marcadas coloridas por tipo. A pessoa pode clicar para remover uma marcação, desenhar uma nova área, ou selecionar uma palavra e escolher o tipo.
5. **Gerar PDF** – cada área é coberta e substituída por uma etiqueta: [PACIENTE], [MÉDICO], [CPF], [RG], [CRM], [ENDEREÇO], [TELEFONE], [E-MAIL], [INSTITUIÇÃO], [ASSINATURA], [LOGO]. Todo o resto permanece igual.
6. **Baixar** – PDF final + opção de copiar só o texto anonimizado (útil para colar na LLM).

## Funcionar offline / baixar para o computador
- App instalável e funcional sem internet (todos os recursos de OCR e detecção incluídos no próprio app).
- Botão "Baixar app" que entrega um pacote (ZIP) para abrir localmente. Observação: por limitação dos navegadores, OCR em arquivo aberto direto como `file://` pode não funcionar; a alternativa recomendada é "Instalar app" (PWA) pelo navegador, que funciona offline. Vou validar qual opção funciona melhor e informar.

## Telas
- Página inicial: explicação curta + área de envio + aviso "nada sai do seu computador".
- Editor de revisão: página à esquerda, lista de dados encontrados à direita (aceitar/recusar cada um).
- Resultado: pré-visualização e download.

## Visual
Clínico e confiável: fundo claro levemente azulado, verde-azulado como cor principal, tipografia limpa e legível, etiquetas coloridas por tipo de dado.

## Aviso de responsabilidade
- Aviso visível na página inicial e caixa de confirmação obrigatória ("Li e concordo") antes do primeiro uso.
- Lembrete na tela de resultado e uma linha discreta no rodapé do PDF gerado.
- Texto: a ferramenta é automática e pode falhar; o documento gerado pode conter diferenças em relação ao original, levando a interpretações errôneas; o desenvolvedor não se responsabiliza por erros, omissões ou dados não removidos; o resultado deve sempre ser conferido e confrontado com o documento original; não substitui avaliação profissional.

## Créditos
Rodapé em todas as telas e seção "Sobre": "Desenvolvido por Marcio Lima · 2026 · Versão 1.0".

## Limitações a saber
- Detecção de nomes sem IA online é baseada em regras (palavras-chave como "Paciente:", "Dr(a).", "CRM", lista de nomes brasileiros comuns). Pode errar — por isso a revisão manual é essencial.
- Fotos tortas ou de baixa qualidade reduzem a precisão do OCR.
- Logos e assinaturas são difíceis de detectar automaticamente; serão sugeridos por posição (cabeçalho/rodapé) e confirmados manualmente.

## Detalhes técnicos
- TanStack Start, tudo client-side; sem backend.
- PDF: `pdfjs-dist` para renderizar e extrair texto com coordenadas; `pdf-lib` para gerar o PDF final (páginas rasterizadas com as áreas cobertas + etiqueta desenhada, garantindo que o texto original não fique escondido por baixo).
- OCR: `tesseract.js` com idioma `por`, worker e dados de idioma servidos localmente em `public/`.
- Detecção: regex com validação de dígitos (CPF, CNS), padrões de RG/CRM/CEP/telefone/e-mail, heurísticas por rótulos e dicionário de nomes; propaga o mesmo nome detectado para todas as ocorrências no documento.
- PWA com service worker para uso offline.
- Testes unitários para os detectores (CPF válido, CRM, telefone, e-mail, rótulos de nome).
