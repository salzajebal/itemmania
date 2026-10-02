/**
 * Shared item/other additions to the mobile trade form. Kept separate so the
 * original game-money form and its spacing remain untouched.
 */
export function mobileSellItemStyles(): string {
  return `<style>
  #im-mobile-sell-register .msi-only{display:none}
   #im-mobile-sell-register:is(.is-item,.is-other) .msi-only{display:block}
   #im-mobile-sell-register:is(.is-item,.is-other) .msr-quantity,
   #im-mobile-sell-register:is(.is-item,.is-other) .msr-meso-price{display:none}
   #im-mobile-sell-register:is(.is-item,.is-other) .msi-price{margin-top:41px}
   #im-mobile-sell-register .msi-price .msr-unit{border:0;padding-left:4px}
   .msi-price{scroll-margin-top:42px}
   .msi-price .msr-warnings{margin-top:34px}
   .msr-section.msi-character{margin-top:43px}
  .msi-character h2,.msi-title h2,.msi-description h2{margin-bottom:14px}
  .msi-character-row{display:flex;gap:9px}
  .msi-character-row input{min-width:0;flex:1;height:55px;border:1px solid #555;border-radius:11px;padding:0 12px;font-size:16px;outline:none;box-shadow:0 1px 4px #00000010}
  .msi-character-row input:focus{border-color:#2598c2}
  .msi-character-row input::placeholder{color:#a3a3a3}
  .msi-save{width:93px;flex:none;border:0;border-radius:10px;background:#199ded;color:#fff;font-size:17px;font-weight:700;box-shadow:0 2px 5px #1689d337}
  .msi-status{min-height:0;margin:5px 0 0;color:#1689af;font-size:13px}
  .msi-status:empty{display:none}
  .msi-banner{display:block;width:100%;margin:42px 0 0;padding:14px 9px;border:0;border-radius:10px;background:#1b9eef;color:#fff;text-align:center;font-size:15px;line-height:21px;box-shadow:0 1px 5px #219bd151}
   .msr-section.msi-title{margin-top:12px}
  .msi-title-line{display:flex;align-items:center;justify-content:space-between;gap:8px}
  .msi-title-line h2{margin-bottom:14px}
  .msi-shop-button{align-self:flex-start;margin-top:0;padding:7px 12px;border:0;border-radius:5px;background:#494949;color:#fff;font-size:14px;font-weight:700;white-space:nowrap;box-shadow:0 1px 4px #0002}
  .msi-title-input{display:block;width:100%;height:54px;padding:0 12px;border:2px solid #2a98bf;border-radius:10px;box-shadow:0 1px 4px #2894ba32;background:#fff;color:#242424;font-size:17px;font-weight:650;outline:none}
   .msr-section.msi-description{margin-top:43px;scroll-margin-top:42px}
  .msi-editor{height:440px;border:2px solid #2a98bf;border-radius:10px;overflow:hidden;box-shadow:0 1px 4px #2894ba32;background:#fff}
  .msi-toolbar{min-height:76px;padding:7px 11px 4px;display:flex;align-content:flex-start;align-items:center;flex-wrap:wrap;column-gap:14px;row-gap:0;border-bottom:1px solid #ddd}
  .msi-toolbar button,.msi-toolbar select{height:31px;min-width:21px;display:inline-flex;align-items:center;justify-content:center;padding:1px 2px;border:0;background:transparent;color:#333;font-size:16px;letter-spacing:0}
  .msi-toolbar select{width:86px;appearance:auto;font-size:15px}
  .msi-toolbar button[aria-pressed="true"]{background:#e8f4f9;border-radius:4px;color:#168cbd}
  .msi-toolbar .msi-align{flex-basis:100%;justify-content:flex-start}
  .msi-toolbar svg{width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:2}
  .msi-color{position:relative}
  .msi-color input{position:absolute;inset:0;opacity:0;width:100%;height:100%;cursor:pointer}
  .msi-editable{height:calc(100% - 76px);padding:15px 17px;overflow:auto;outline:none;font-size:15px;line-height:1.55;letter-spacing:-.045em;white-space:pre-wrap;overflow-wrap:anywhere}
   .msr-warnings.msi-post-warnings{margin-top:10px}
  .msi-post-warnings li{margin-bottom:9px}
  .msi-post-warnings li:first-child,.msi-post-warnings li:first-child .msr-check{color:#c93840}
   .msi-next{width:100%;height:72px;margin:53px 0 0;border:0;border-radius:15px;background:#1c9eef;color:#fff;font-size:22px;font-weight:750;box-shadow:0 2px 6px #128fc13b}
  .msi-next-message{margin:12px 0 0;font-size:14px;color:#22728d;line-height:1.45}
  .msi-next-message:empty{display:none}
   #im-mobile-sell-register:is(.is-item,.is-other) .msr-footer{margin-top:76px}
   #im-mobile-sell-register:is(.is-item,.is-other) .msr-support{min-height:108px}
  .msi-footer-extra{padding:14px 12px 10px;font-size:14px;line-height:1.38}
  .msi-company{display:flex;align-items:center;gap:7px;padding:0;border:0;background:none;color:#222;font-size:16px;font-weight:700}
  .msi-company-details{margin:9px 0;color:#777;font-size:12px}
  .msi-copyright{margin:12px 0 17px;color:#267caa}
   .msi-disclaimer{padding-top:17px;border-top:1px solid #e6e6e6;margin:0;font-size:15px}
  .msi-pc{display:inline-block;margin-top:11px;padding:4px 9px;border:1px solid #ddd;border-radius:9px;background:#fff;color:#292929;font-size:14px}
  .msi-dialog{width:min(390px,calc(100% - 32px));padding:24px;border:0;border-radius:14px;box-shadow:0 15px 45px #0005;color:#222;font-family:inherit}
  .msi-dialog::backdrop{background:#0006}
  .msi-dialog h2{margin:0 0 13px;font-size:19px}
  .msi-dialog p{margin:0 0 16px;font-size:14px;color:#666}
  .msi-dialog input{width:100%;height:45px;border:1px solid #aaa;border-radius:7px;padding:0 10px;font-size:16px}
  .msi-dialog-actions{display:flex;justify-content:flex-end;gap:9px;margin-top:17px}
  .msi-dialog-actions button{padding:9px 16px;border:1px solid #ccc;border-radius:7px;background:#fff}
  .msi-dialog-actions button:last-child{background:#1b9eef;border-color:#1b9eef;color:#fff}
  @media(max-width:390px){.msi-toolbar{column-gap:10px}.msi-character-row input{font-size:14px}.msi-save{width:76px}.msi-banner{font-size:13px}}
  </style>`;
}

export function mobileSellItemMarkup(buy = false): string {
  return `<section class="msr-section msi-price msi-only" id="msi-form">
  <h2><label for="msi-price">${buy ? "구매" : "판매"}금액을 입력해주세요.</label></h2>
  <div class="msr-input-wrap"><input id="msi-price" type="text" inputmode="numeric" pattern="[0-9,]*" autocomplete="off" placeholder="(1,000원 이상, 10원 단위 입력 가능)" aria-describedby="msi-price-error" data-testid="input-item-price"><span class="msr-unit">원</span></div>
  <p class="msr-validation" id="msi-price-error" role="alert"></p>
  ${buy ? "" : '<p class="msr-calculation">수수료 5% : <strong id="msi-fee" data-testid="text-item-fee">0원</strong><span class="msr-net">실 수령액 : <strong id="msi-net" data-testid="text-item-net">0원</strong></span></p>'}
  <ul class="msr-warnings"><li><span class="msr-check" aria-hidden="true">✓</span><span>평균 시세보다 현저히 낮은 금액으로 등록할 경우, 거래 상대자 피해 및 시세조작등의 사유로 상품등록이 제한될 수 있습니다.</span></li>${buy ? "" : '<li><span class="msr-check" aria-hidden="true">✓</span><span>연간 기준으로 4,800만원 이상 판매 시 과세 대상에 포함될 수 있습니다.</span></li>'}</ul>
  <section class="msr-section msi-character"><h2><label for="msi-character">캐릭터명을 입력해주세요.</label></h2><div class="msi-character-row"><input id="msi-character" type="text" maxlength="40" placeholder="물품을 전달 ${buy ? "받으실" : "하실"} 본인의 캐릭터명" data-testid="input-character"><button type="button" class="msi-save" id="msi-character-save" data-testid="button-save-character">저장</button></div><p class="msi-status" id="msi-character-status" role="status"></p></section>
  <div class="msi-banner">${buy ? "눈에 띄는 상점명으로 더 빨리 구매하세요! 👀" : "개성 있는 상점명으로 단골 구매자를 확보하세요! 🏠"}</div>
  <section class="msr-section msi-title"><div class="msi-title-line"><h2><label for="msi-title">상품제목을 입력해주세요.</label></h2><button type="button" class="msi-shop-button" id="msi-shop-open" data-testid="button-set-shop-name">상점명 설정하기</button></div><input id="msi-title" class="msi-title-input" value="아이템 ${buy ? "삽니다." : "팝니다."}" maxlength="100" data-testid="input-item-title"><p class="msr-validation" id="msi-title-error" role="alert"></p></section>
  <section class="msr-section msi-description" id="msi-description-section"><h2>상세설명을 입력해주세요.</h2><div class="msi-editor"><div class="msi-toolbar" role="toolbar" aria-label="상세설명 서식">
  <button type="button" id="msi-image" aria-label="이미지 추가" title="이미지 추가" data-testid="button-editor-image"><svg viewBox="0 0 20 20"><rect x="2" y="3" width="16" height="14" rx="1"/><circle cx="7" cy="7" r="1"/><path d="m4 15 4-4 3 2 3-4 3 6"/></svg></button><input id="msi-image-file" type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden>
  <button type="button" data-format="bold" aria-label="굵게" title="굵게" data-testid="button-editor-bold"><b>B</b></button>
  <button type="button" data-format="underline" aria-label="밑줄" title="밑줄" data-testid="button-editor-underline"><u>U</u></button>
  <button type="button" data-format="strikeThrough" aria-label="취소선" title="취소선" data-testid="button-editor-strike"><s>S</s></button>
  <select id="msi-font-size" aria-label="글자 크기" data-testid="select-editor-size"><option value="2">Small</option><option value="3">Normal</option><option value="4">Large</option><option value="5">Huge</option></select>
  <span class="msi-color"><button type="button" aria-label="글자 색상" title="글자 색상"><u>A</u></button><input id="msi-text-color" type="color" value="#333333" aria-label="글자 색상 선택" data-testid="input-editor-color"></span>
  <span class="msi-color"><button type="button" aria-label="배경 색상" title="배경 색상">▨</button><input id="msi-background-color" type="color" value="#ffff00" aria-label="배경 색상 선택" data-testid="input-editor-background"></span>
  <button type="button" class="msi-align" id="msi-align" aria-label="문단 정렬" title="문단 정렬" data-testid="button-editor-align">☰</button>
  </div><div id="msi-editable" class="msi-editable" contenteditable="true" role="textbox" aria-multiline="true" aria-label="상세설명" data-testid="input-item-description">아이템 ${buy ? "삽니다." : "팝니다."}</div></div><p class="msr-validation" id="msi-description-error" role="alert"></p>
  <ul class="msr-warnings msi-post-warnings"><li><span class="msr-check" aria-hidden="true">✓</span><span>휴대폰번호, 메신저(카톡) ID 및 거래와 무관한 내용 기재 시 상품은 삭제되며, 서비스 이용에 제재를 받게 됩니다.</span></li><li><span class="msr-check" aria-hidden="true">✓</span><span>거래 시 거래 교환 창 스크린샷과 완료 스크린샷을 보유하시길 바랍니다.</span></li></ul>
  <button type="button" class="msi-next" id="msi-next" data-testid="button-item-next">다음</button><p class="msi-next-message" id="msi-next-message" role="status" aria-live="polite"></p></section></section>
  <dialog class="msi-dialog" id="msi-shop-dialog" aria-labelledby="msi-shop-heading"><h2 id="msi-shop-heading">상점명 설정하기</h2><p>상점명을 입력해 주세요.</p><input id="msi-shop-input" type="text" maxlength="30" placeholder="상점명" data-testid="input-shop-name"><p class="msr-validation" id="msi-shop-error" role="alert"></p><div class="msi-dialog-actions"><button type="button" id="msi-shop-cancel" data-testid="button-cancel-shop-name">취소</button><button type="button" id="msi-shop-save" data-testid="button-save-shop-name">저장</button></div></dialog>`;
}

export function mobileSellItemFooter(gameCode: string, buy = false): string {
  return `<div class="msi-footer-extra msi-only"><button class="msi-company" id="msi-company" type="button" aria-expanded="false" data-testid="button-company">(주)아이엠아이 <span aria-hidden="true">⌄</span></button><div class="msi-company-details" id="msi-company-details" hidden>아이템매니아 서비스 운영사 (주)아이엠아이</div><p class="msi-copyright">Copyright © IMI. All rights reserved.</p><p class="msi-disclaimer">아이템매니아는 통신판매중개자이며 통신판매의 당사자가 아닙니다.<br>따라서 아이템매니아는 상품 거래정보 및 거래에 대하여 책임을 지지 않습니다.</p><a class="msi-pc" href="/${buy ? "buy" : "sell"}/register.html?search_game=${encodeURIComponent(gameCode)}&pc=1" data-testid="link-pc-version">PC버전</a></div>`;
}

export function mobileSellItemScript(): string {
  return `
  var itemPrice=document.getElementById('msi-price'),itemTitle=document.getElementById('msi-title'),itemEditor=document.getElementById('msi-editable');
  var sellDetailState={};
  function captureSellDetail(kind){
     sellDetailState[kind]={price:itemPrice.value,title:itemTitle.value,description:itemEditor.textContent,editorNodes:Array.from(itemEditor.childNodes).map(function(node){return node.cloneNode(true)}),character:character.value,shopName:shopName,imagePreviewOnly:itemImagePreviewOnly,tradeType:document.querySelector('[data-trade][aria-pressed="true"]').getAttribute('data-trade')};
  }
  function restoreSellDetail(kind){
    var saved=sellDetailState[kind];
    if(!saved)try{
      var draft=JSON.parse(sessionStorage.getItem('mobile-'+(isBuy?'buy':'sell')+'-'+kind+'-draft')||'null');
      if(draft&&draft.gameCode===params.get('search_game')&&draft.category===kind)saved=draft;
    }catch(e){}
    var label=(kind==='other'?'기타':'아이템')+' '+(isBuy?'삽니다.':'팝니다.');
    itemPrice.value=saved&&saved.price!=null?(typeof saved.price==='number'?saved.price.toLocaleString('ko-KR'):String(saved.price)):'';
    itemTitle.value=saved&&typeof saved.title==='string'?saved.title:label;
    if(saved&&saved.editorNodes)itemEditor.replaceChildren.apply(itemEditor,saved.editorNodes.map(function(node){return node.cloneNode(true)}));
    else itemEditor.textContent=saved&&typeof saved.description==='string'?saved.description:label;
    character.value=saved&&typeof saved.character==='string'?saved.character:'';
    shopName=saved&&typeof saved.shopName==='string'?saved.shopName:'';
    document.getElementById('msi-shop-open').textContent=shopName||'상점명 설정하기';
    itemImagePreviewOnly=Boolean(saved&&saved.imagePreviewOnly);
     if(isBuy)document.querySelector('[data-trade="'+(saved&&saved.tradeType==='split'?'split':'normal')+'"]').click();
    characterStatus.textContent='';
    document.getElementById('msi-title-error').textContent='';
    document.getElementById('msi-description-error').textContent='';
    document.getElementById('msi-next-message').textContent='';
    itemUpdatePrice();
  }
  function itemUpdatePrice(){
    var raw=itemPrice.value.replace(/,/g,''),p=Number(raw),valid=raw!==''&&Number.isSafeInteger(p)&&p>=1000&&p%10===0;
    document.getElementById('msi-price-error').textContent=raw&&!valid?'1,000원 이상, 10원 단위로 입력해 주세요.':'';
    itemPrice.setAttribute('aria-invalid',String(Boolean(raw&&!valid)));
    var charge=valid?Math.round(p*.05):0;
    var fee=document.getElementById('msi-fee'),net=document.getElementById('msi-net');
    if(fee&&net){fee.textContent=charge.toLocaleString('ko-KR')+'원';net.textContent=(valid?p-charge:0).toLocaleString('ko-KR')+'원'}
    return valid;
  }
  itemPrice.addEventListener('input',function(){var raw=itemPrice.value.replace(/\\D/g,'');itemPrice.value=raw?Number(raw).toLocaleString('ko-KR'):'';itemUpdatePrice()});
  var character=document.getElementById('msi-character'),characterStatus=document.getElementById('msi-character-status');
  document.getElementById('msi-character-save').addEventListener('click',function(){
    var name=character.value.trim();characterStatus.textContent=name?('캐릭터명 '+name+' 저장되었습니다.'):'캐릭터명을 입력해 주세요.';
    if(name)try{sessionStorage.setItem('msi-character-'+(isBuy?'buy-':'sell-')+(root.classList.contains('is-other')?'other':'item'),name)}catch(e){}
  });
  character.addEventListener('input',function(){characterStatus.textContent=''});
  var shopDialog=document.getElementById('msi-shop-dialog'),shopInput=document.getElementById('msi-shop-input'),shopName='';
  document.getElementById('msi-shop-open').addEventListener('click',function(){shopInput.value=shopName;document.getElementById('msi-shop-error').textContent='';shopDialog.showModal();shopInput.focus()});
  document.getElementById('msi-shop-cancel').addEventListener('click',function(){shopDialog.close()});
  document.getElementById('msi-shop-save').addEventListener('click',function(){
    var value=shopInput.value.trim();
    if(!value){document.getElementById('msi-shop-error').textContent='상점명을 입력해 주세요.';shopInput.focus();return}
    shopName=value;document.getElementById('msi-shop-open').textContent=value;shopDialog.close();
  });
  var savedSelection=null;
  itemEditor.addEventListener('keyup',function(){var selection=window.getSelection();if(selection&&selection.rangeCount)savedSelection=selection.getRangeAt(0).cloneRange()});
  itemEditor.addEventListener('mouseup',function(){var selection=window.getSelection();if(selection&&selection.rangeCount)savedSelection=selection.getRangeAt(0).cloneRange()});
  function formatItem(command,value){
    itemEditor.focus();
    if(savedSelection&&itemEditor.contains(savedSelection.commonAncestorContainer)){var selection=window.getSelection();selection.removeAllRanges();selection.addRange(savedSelection)}
    document.execCommand(command,false,value||null);
  }
  document.querySelectorAll('[data-format]').forEach(function(button){button.addEventListener('click',function(){formatItem(button.getAttribute('data-format'));button.setAttribute('aria-pressed',String(button.getAttribute('aria-pressed')!=='true'))})});
  document.getElementById('msi-font-size').addEventListener('change',function(e){formatItem('fontSize',e.target.value)});
  document.getElementById('msi-text-color').addEventListener('input',function(e){formatItem('foreColor',e.target.value)});
  document.getElementById('msi-background-color').addEventListener('input',function(e){formatItem('hiliteColor',e.target.value)});
  var alignment=0,alignments=['justifyLeft','justifyCenter','justifyRight'];
  document.getElementById('msi-align').addEventListener('click',function(){alignment=(alignment+1)%3;formatItem(alignments[alignment]);this.title=['왼쪽 정렬','가운데 정렬','오른쪽 정렬'][alignment]});
  document.getElementById('msi-image').addEventListener('click',function(){document.getElementById('msi-image-file').click()});
   var itemImagePreviewOnly=false;
   document.getElementById('msi-image-file').addEventListener('change',function(e){
    var file=e.target.files[0];if(!file||!['image/png','image/jpeg','image/webp','image/gif'].includes(file.type)||file.size>2*1024*1024){document.getElementById('msi-description-error').textContent='2MB 이하 이미지 파일을 선택해 주세요.';return}
     var reader=new FileReader();reader.onload=function(){if(typeof reader.result==='string'&&reader.result.startsWith('data:image/')){formatItem('insertImage',reader.result);itemImagePreviewOnly=true;document.getElementById('msi-description-error').textContent='이미지는 미리보기만 가능하며 임시 저장되지 않습니다.'}};reader.readAsDataURL(file);e.target.value='';
  });
  document.getElementById('msi-next').addEventListener('click',function(){
    var priceValid=itemUpdatePrice(),titleValid=!!itemTitle.value.trim(),descriptionValid=!!itemEditor.textContent.trim();
    if(!priceValid&&!itemPrice.value.trim())document.getElementById('msi-price-error').textContent='1,000원 이상, 10원 단위로 입력해 주세요.';
    document.getElementById('msi-title-error').textContent=titleValid?'':'상품제목을 입력해 주세요.';
    document.getElementById('msi-description-error').textContent=descriptionValid?'':'상세설명을 입력해 주세요.';
    var message=document.getElementById('msi-next-message');
     if(!priceValid||!titleValid||!descriptionValid){message.textContent=(isBuy?'구매':'판매')+'금액, 상품제목, 상세설명을 확인해 주세요.';(!priceValid?itemPrice:!titleValid?itemTitle:itemEditor).focus();return}
     if(itemEditor.querySelector('img')){message.textContent='이미지는 현재 등록에 저장되지 않습니다. 이미지를 지운 뒤 등록해 주세요.';itemEditor.focus();return}
     var selectedOption=document.querySelector('#msr-servers [role="option"][aria-selected="true"]');
     var category=root.classList.contains('is-other')?'other':'item';
      var draft={category:category,mode:isBuy?'buy':'sell',gameCode:params.get('search_game'),serverName:selectedOption?selectedOption.textContent.trim():'',tradeType:document.querySelector('[data-trade][aria-pressed="true"]').getAttribute('data-trade'),price:Number(itemPrice.value.replace(/,/g,'')),character:character.value.trim(),shopName:shopName,title:itemTitle.value.trim(),description:itemEditor.textContent.trim()};
       try{sessionStorage.setItem('mobile-'+(isBuy?'buy':'sell')+'-'+category+'-draft',JSON.stringify(draft))}catch(e){}
       message.textContent='';showRegistrationReview(draft);
  });
  var company=document.getElementById('msi-company'),details=document.getElementById('msi-company-details');
  company.addEventListener('click',function(){details.hidden=!details.hidden;company.setAttribute('aria-expanded',String(!details.hidden))});
  `;
}