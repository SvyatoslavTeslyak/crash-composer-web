// Public endpoints only. Uses the same QA service as the existing Composer connection.
// depositUrl: an https page where a player can top up. Left empty until one exists; the
// balance notice then says its piece without offering a button that leads nowhere.
window.LotomobilPlayerConfig={environment:'QA',authBaseUrl:'https://api.qa.lotomobil.com/',apiBaseUrl:'https://api.qa.lotomobil.com/',depositUrl:'',gameUrl:new URL('games/pixi/road/index.html',location.href).href};
