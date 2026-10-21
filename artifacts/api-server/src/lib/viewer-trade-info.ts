import { load } from "cheerio";

type Viewer = Record<string, unknown> | null;
const guestLabel = "로그인 후 확인";

/** Personalize only the viewer's panel, never the listing owner's identity.
 * Replace captured values before sending HTML, including when JS/API fails.
 * Parse only the small panel so embedded snapshot images/styles stay untouched.
 */
export function applyViewerTradeInfo(html: string, viewer: Viewer): string {
  const opening = /<div\b[^>]*\bclass=(?:"[^"]*\bmy_private\b[^"]*"|'[^']*\bmy_private\b[^']*'|my_private)[^>]*>/gi;
  const edits: Array<{ start: number; end: number; html: string }> = [];
  let match: RegExpExecArray | null;
  while ((match = opening.exec(html))) {
    const tags = /<\/?div\b[^>]*>/gi;
    tags.lastIndex = opening.lastIndex;
    let depth = 1;
    let tag: RegExpExecArray | null;
    while (depth && (tag = tags.exec(html))) {
      depth += /^<\/div/i.test(tag[0]) ? -1 : 1;
    }
    if (depth) throw new Error("Malformed private trade-info panel");
    const $ = load(html.slice(match.index, tags.lastIndex), {}, false);
    const panel = $(".my_private");
    const name = viewer ? String(viewer.nickname || viewer.email || "회원") : guestLabel;
    panel.find("li.user_name").each((_i, el) => {
      const item = $(el);
      item.contents().filter((_j, node) => node.type === "text").remove();
      item.find("[data-im-viewer-name]").remove();
      const label = $("<span>").attr("data-im-viewer-name", "").text(name);
      item.prepend(label, " ");
      item.find("a").attr("aria-disabled", viewer ? "false" : "true");
      if (!viewer) item.find("a").attr("hidden", "");
      else item.find("a").removeAttr("hidden");
    });
    panel.find("#spnUserPhone").text(viewer ? "자택번호 없음 " : guestLabel);
    panel.find("#spnUserCell").text(viewer ? String(viewer.phone || "등록된 연락처 없음") : guestLabel);
    edits.push({ start: match.index, end: tags.lastIndex, html: $.html() });
    opening.lastIndex = tags.lastIndex;
  }
  for (const edit of edits.reverse()) {
    html = html.slice(0, edit.start) + edit.html + html.slice(edit.end);
  }
  return html;
}

// Revalidate on history restoration; never restore another session's panel from
// the browser back/forward cache. Failure displays no cached personal values.
export const VIEWER_TRADE_INFO_SCRIPT = String.raw`<script>
(function(){
  var revision=0;
  function render(me,failed){
    document.querySelectorAll('.my_private').forEach(function(panel){
      var label=failed?'정보 확인 불가':'로그인 후 확인';
      panel.querySelectorAll('[data-im-viewer-name]').forEach(function(el){
        el.textContent=me?(me.nickname||me.email||'회원'):label;
      });
      panel.querySelectorAll('li.user_name a').forEach(function(el){
        el.hidden=!me;el.setAttribute('aria-disabled',me?'false':'true');
      });
      var home=panel.querySelector('#spnUserPhone'),cell=panel.querySelector('#spnUserCell');
      if(home)home.textContent=me?'자택번호 없음 ':label;
      if(cell)cell.textContent=me?(me.phone||'등록된 연락처 없음'):label;
    });
  }
  function refresh(){
    var token=++revision;
    render(null,false);
    fetch('/api/auth/me',{credentials:'include',cache:'no-store'})
      .then(function(r){
        if(r.status===401||r.status===403)return null;
        if(!r.ok)throw new Error('viewer lookup failed');
        return r.json();
      })
      .then(function(me){if(token===revision)render(me&&me.id?me:null,false);})
      .catch(function(){if(token===revision)render(null,true);});
  }
  window._IM_refreshTradeInfo=refresh;
  window.addEventListener('pagehide',function(){revision++;render(null,false);});
  window.addEventListener('pageshow',function(e){if(e.persisted)refresh();});
})();
</script>`;
