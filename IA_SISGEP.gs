function chamarIA_SISGEP(promptUsuario) {

  const apiKey = PropertiesService
    .getScriptProperties()
    .getProperty('ANTHROPIC_API_KEY');

  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY não encontrada.');
  }

  const payload = {
  model: "claude-haiku-4-5-20251001",
    max_tokens: 1500,
    system: `
Você é o Assistente Oficial do SISGEP/SindEducação-ES.

Regras:
- Responda sempre em português do Brasil.
- Utilize linguagem profissional.
- Seja objetivo.
- Não invente informações.
- Preserve nomes, datas, valores e CNPJs.
- Quando solicitado para melhorar textos, entregue apenas a versão final.
`,
    messages: [
      {
        role: "user",
        content: promptUsuario
      }
    ]
  };

  const response = UrlFetchApp.fetch(
    "https://api.anthropic.com/v1/messages",
    {
      method: "post",
      contentType: "application/json",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    }
  );

  const codigo = response.getResponseCode();
  const texto = response.getContentText();

  Logger.log("HTTP: " + codigo);

  if (codigo !== 200) {
    Logger.log(texto);
    throw new Error("Erro na IA: " + texto);
  }

  const json = JSON.parse(texto);

  if (!json.content || !json.content.length) {
    throw new Error("Nenhuma resposta retornada pela IA.");
  }

  return json.content[0].text.trim();
}