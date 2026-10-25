// Summary module. Everything about talking to the AI lives here,
// so a future app version can swap this for a call to its own server.
(function () {
  var API_URL = "https://api.anthropic.com/v1/messages";

  var SYSTEM = [
    "너는 매일 성경을 읽는 사람을 돕는 친절한 안내자야.",
    "사용자가 방금 읽은 개역한글 본문을 쉬운 요즘 한국어로 요약해.",
    "본문이 실제로 말하는 내용에 충실하고, 교단마다 다른 해석이나 논쟁은 피해.",
    "문장은 짧고 따뜻하게, 존댓말 평서문으로 써.",
    "반드시 JSON 객체 하나만 출력하고 그 밖의 글은 쓰지 마."
  ].join("\n");

  function formatSpec(mode) {
    if (mode === "each") {
      return [
        "다음 형식의 JSON으로 답해.",
        '{"chapters":[{"title":"사무엘상 25장","points":["한 문장","한 문장"]}],"key_verse":"사무엘상 25:32","message":"한두 문장"}',
        "chapters에는 장마다 하나씩, points는 장마다 1~2개의 쉬운 한 문장 요약이야.",
        "key_verse는 오늘 본문 전체에서 가장 중심이 되는 구절 하나의 위치를 '책이름 장:절' 형식으로 써. 구절 내용은 쓰지 마.",
        "message는 핵심 메시지야. 오늘 본문이 읽는 사람에게 주는 메시지를 한두 문장으로 써."
      ].join("\n");
    }
    return [
      "다음 형식의 JSON으로 답해.",
      '{"points":["한 문장","한 문장","한 문장"],"key_verse":"사무엘상 25:32","message":"한두 문장"}',
      "points는 오늘 읽은 본문 전체의 흐름을 순서대로 담은 쉬운 한 문장 요약 3개야.",
      "key_verse는 가장 중심이 되는 구절 하나의 위치를 '책이름 장:절' 형식으로 써. 구절 내용은 쓰지 마.",
      "message는 핵심 메시지야. 오늘 본문이 읽는 사람에게 주는 메시지를 한두 문장으로 써."
    ].join("\n");
  }

  // sections: [{ bookName, chapter, verses: [string] }]
  function buildPrompt(sections, mode) {
    var body = sections.map(function (s) {
      var lines = s.verses.map(function (v, i) { return s.chapter + ":" + (i + 1) + " " + v; });
      return "[" + s.bookName + " " + s.chapter + "장]\n" + lines.join("\n");
    }).join("\n\n");
    return formatSpec(mode) + "\n\n오늘 읽은 본문\n\n" + body;
  }

  function fullCopyText(sections, mode) {
    return SYSTEM + "\n\n" + buildPrompt(sections, mode);
  }

  function parse(text) {
    var start = text.indexOf("{");
    var end = text.lastIndexOf("}");
    if (start < 0 || end <= start) throw new Error("응답 형식이 달라요");
    var data = JSON.parse(text.slice(start, end + 1));
    if (!data.message || !(data.points || data.chapters)) throw new Error("응답 형식이 달라요");
    return data;
  }

  function request(apiKey, model, sections, mode) {
    return fetch(API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true"
      },
      body: JSON.stringify({
        model: model,
        max_tokens: 1500,
        system: SYSTEM,
        messages: [{ role: "user", content: buildPrompt(sections, mode) }]
      })
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (json) {
        if (!res.ok) {
          var msg = (json && json.error && json.error.message) || ("HTTP " + res.status);
          if (res.status === 401) msg = "API 키를 확인해 주세요.";
          if (res.status === 429) msg = "잠시 후 다시 시도해 주세요.";
          throw new Error(msg);
        }
        var text = (json.content || []).filter(function (c) { return c.type === "text"; }).map(function (c) { return c.text; }).join("");
        return parse(text);
      });
    });
  }

  window.Summary = { request: request, fullCopyText: fullCopyText };
})();
