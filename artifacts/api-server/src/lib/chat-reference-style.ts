export const CHAT_REFERENCE_STYLE = `<style id="chat-reference-style">
html,body{margin:0!important;background:#eef0fb!important;height:100%!important;min-width:0!important;max-width:100%!important;overflow:hidden!important;font-family:'Malgun Gothic','Apple SD Gothic Neo',sans-serif!important}
body{box-sizing:border-box!important;padding:12px 16px 0!important}
.popup_content{padding:0!important;margin:0!important}
.chat_room,.chat_room *{box-sizing:border-box}
.chat_room{display:flex!important;flex-direction:column!important;width:100%!important;max-width:100%!important;min-width:0!important;height:calc(100dvh - 12px)!important;margin:0!important;padding:0!important;background:#fff!important;border:1px solid #dcdff0!important;border-bottom:0!important;border-radius:22px 22px 0 0!important;overflow:hidden!important;position:relative!important}
.chat_room .chat_info_wrap{flex:0 0 auto!important;position:relative!important;display:flex!important;align-items:flex-start!important;width:100%!important;height:auto!important;min-height:0!important;margin:0!important;padding:12px 16px 10px 14px!important;background:#fff!important;border:0!important;float:none!important}
.chat_info_wrap a.back_btn{flex:0 0 auto!important;position:static!important;display:block!important;width:28px!important;height:34px!important;margin:18px 12px 0 0!important;float:none!important}
.chat_info_wrap .chat_info{flex:1 1 auto!important;min-width:0!important;width:auto!important;margin:0!important;padding:0 120px 0 0!important;float:none!important;position:static!important}
.chat_info .chat_user{display:flex!important;align-items:center!important;gap:8px!important;margin:0!important;padding:0!important;height:auto!important;line-height:1.3!important}
.chat_info .chat_user .uid{font-size:15px!important;font-weight:700!important;color:#222!important;margin:0!important;float:none!important}
.chat_info .chat_user .credit_mark_new{flex:0 0 auto!important;float:none!important}
.chat_info .chat-connection-state{display:inline-block!important;margin:0!important;padding:2px 9px!important;border-radius:11px!important;background:#e4f6ea!important;color:#1b9a4b!important;font-size:11px!important;font-weight:700!important;line-height:1.3!important;float:none!important}
.chat_info .chat_user2{margin:8px 0 0!important;padding:0!important;float:none!important;width:auto!important}
.chat_info .subject,.chat_info .subject a{font-size:14px!important;font-weight:700!important;color:#222!important;line-height:1.4!important;margin:0!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;display:block!important}
.chat_info .sub_info{display:flex!important;flex-wrap:wrap!important;align-items:center!important;gap:0 6px!important;margin:3px 0 0!important;font-size:12.5px!important;color:#777!important;line-height:1.5!important}
.chat_info .sub_info div,.chat_info .sub_info a{display:inline!important;float:none!important;color:#777!important;font-size:12.5px!important;font-weight:400!important;margin:0!important;padding:0!important}
.chat_info .sub_info .tid:after{content:"|";margin-left:8px;color:#ccc}
#trade_state_text.trade_state{position:absolute!important;top:36px!important;right:16px!important;left:auto!important;width:auto!important;margin:0!important;padding:7px 18px!important;background:#fff!important;border:1.5px solid #333!important;border-radius:9px!important;color:#222!important;font-size:13px!important;font-weight:600!important;line-height:1.3!important;float:none!important}
.chat_content_wrap{display:flex!important;flex-direction:row!important;flex-wrap:nowrap!important;flex:1 1 auto!important;min-height:0!important;width:100%!important;height:auto!important;margin:0!important;padding:0!important;border-top:1px solid #e3e5f0!important;overflow:hidden!important}
.chat_content_wrap .chat_area{display:flex!important;flex-direction:column!important;flex:1 1 auto!important;min-width:0!important;min-height:0!important;width:auto!important;height:auto!important;margin:0!important;padding:0!important;float:none!important;overflow:hidden!important;background:#fff!important}
.chat_area .chat_content{display:flex!important;flex-direction:column!important;flex:1 1 auto!important;min-height:0!important;width:100%!important;height:auto!important;margin:0!important;padding:0!important;overflow:hidden!important;position:static!important}
#chat_user_info.chat_user_info{flex:0 0 auto!important;display:flex!important;align-items:center!important;gap:12px!important;width:100%!important;margin:0!important;padding:10px 14px!important;background:#eef0fd!important;border:0!important;position:static!important;float:none!important;min-height:0!important}
#chat_user_info .user_info_txt{flex:0 0 auto!important;display:flex!important;align-items:center!important;justify-content:center!important;text-align:center!important;width:auto!important;min-width:44px!important;height:auto!important;padding:7px 9px!important;background:#fff!important;border:1.5px solid #4a73f0!important;border-radius:8px!important;color:#3a63d8!important;font-size:12px!important;font-weight:700!important;line-height:1.3!important;float:none!important;margin:0!important}
#chat_user_info > ul{flex:1 1 auto!important;min-width:0!important;display:flex!important;flex-wrap:wrap!important;align-items:center!important;gap:4px 12px!important;margin:0!important;padding:0!important;list-style:none!important;float:none!important;width:auto!important}
#chat_user_info > ul > li{display:inline-block!important;float:none!important;width:auto!important;margin:0!important;padding:0!important;font-size:14px!important;color:#222!important;line-height:1.5!important}
#chat_user_info > ul > li.character{display:block!important;flex:0 0 100%!important;width:100%!important}
#chat_user_info li.character button.other_font{display:inline-block!important;margin-left:6px!important;padding:1px 10px!important;background:#fff!important;border:1px solid #4a73f0!important;border-radius:12px!important;color:#3a63d8!important;font-size:11.5px!important;font-weight:600!important;line-height:1.6!important;vertical-align:middle!important;height:auto!important}
#chat_notice.chat_notice{flex:0 0 auto!important;width:100%!important;margin:0!important;padding:12px 14px 4px!important;background:#fff!important;border:0!important;position:static!important}
#chat_notice_txt.chat_notice_txt{display:block!important;position:relative!important;width:100%!important;margin:0!important;padding:12px 14px 12px 54px!important;min-height:52px!important;background:#f1f2f4 none!important;background-image:none!important;border:0!important;border-radius:12px!important;color:#666!important;font-size:12.5px!important;line-height:1.5!important;text-align:left!important}
#chat_notice_txt:before{content:"\\2713"!important;position:absolute!important;left:14px!important;top:50%!important;transform:translateY(-50%)!important;width:22px!important;height:22px!important;line-height:22px!important;text-align:center!important;background:#3aaa55!important;color:#fff!important;border-radius:4px!important;font-size:15px!important;font-weight:700!important}
#chat_notice_txt b{font-size:14px!important;color:#222!important;font-weight:700!important}
#chat_notice_txt .sub_txt{color:#666!important;font-size:12.5px!important}
#chat_content_list.chat_content_list{flex:1 1 auto!important;min-height:0!important;height:auto!important;max-height:none!important;overflow-y:auto!important;overflow-x:hidden!important;padding:8px 14px!important;margin:0!important}
#chat_content_list .date{display:block!important;text-align:center!important;margin:10px 0!important;background:none!important}
#chat_content_list .date span{display:inline-block!important;padding:5px 20px!important;background:#d9d9dc!important;color:#555!important;border-radius:16px!important;font-size:12px!important}
#chat_bottom.chat_bottom{flex:0 0 auto!important;position:relative!important;width:100%!important;margin:0!important;padding:8px 12px 10px!important;background:#fff!important}
#chat_bottom .write_area{width:100%!important;max-width:100%!important}
#write_chat{max-width:100%!important;width:100%!important}
.chat_content_wrap .chat_menu_area{display:flex!important;flex-direction:column!important;flex:0 0 166px!important;width:166px!important;min-width:166px!important;max-width:166px!important;height:auto!important;margin:0!important;padding:14px 16px!important;float:none!important;position:static!important;background:#fff!important;border-left:1px solid #e3e5f0!important;overflow-y:auto!important;overflow-x:hidden!important}
.chat_menu_area .chat_menu{width:100%!important;float:none!important;margin:0!important;padding:0!important}
.chat_menu_area .chat_menu button,.chat_menu_area .chat_menu > a{width:100%!important;max-width:100%!important;background-color:#fff!important;border:1px solid #d9dce8!important;border-radius:10px!important;font-size:13px!important;font-weight:700!important}
@media (max-width:559px){
body{padding:8px 8px 0!important}
.chat_room{height:calc(100dvh - 8px)!important;border-radius:16px 16px 0 0!important}
.chat_room .chat_info_wrap{padding:10px 10px 8px!important}
.chat_info_wrap .chat_info{padding-right:0!important}
#trade_state_text.trade_state{position:static!important;display:inline-block!important;margin-top:6px!important}
.chat_info_wrap{flex-wrap:wrap!important}
.chat_content_wrap{flex-direction:column!important;overflow-y:auto!important}
.chat_content_wrap .chat_area{flex:1 0 70vh!important}
.chat_content_wrap .chat_menu_area{flex:0 0 auto!important;width:100%!important;min-width:0!important;max-width:none!important;flex-direction:row!important;flex-wrap:wrap!important;border-left:0!important;border-bottom:1px solid #e3e5f0!important;padding:8px!important}
}
.chat_room .chat_info_wrap{gap:0!important}
.chat_info_wrap .chat_info{flex:1 1 0!important;gap:6px!important;padding-right:88px!important}
.chat_info .chat_user .credit_mark_new{width:24px!important;height:24px!important;background-size:24px 24px!important}
.chat_user2 .sub_info{display:flex!important;align-items:center!important;white-space:nowrap!important;overflow:hidden!important}
.chat_user2 .sub_info .tid{display:inline-flex!important;align-items:center!important;flex:0 1 auto!important;min-width:0!important;max-width:45%!important;white-space:nowrap!important}
.chat_user2 .sub_info .tid a{display:block!important;min-width:0!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}
.chat_user2 .sub_info .tid:after{background:none!important;width:auto!important;height:auto!important}
.chat_user2 .sub_info > a{min-width:0!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}
#trade_state_text.trade_state{top:52px!important;bottom:auto!important;width:80px!important;height:30px!important;min-width:0!important;max-width:160px!important;padding:0 6px!important;line-height:28px!important;text-align:center!important;border-radius:6px!important}
.chat_menu_area .chat_menu button{height:36px!important;min-height:36px!important;margin-bottom:8px!important;border-radius:8px!important}
.chat_menu_area .chat_menu button.chat_block,.chat_menu_area .chat_menu button.chat_alarm{font-size:0!important}
.chat_menu .chat_block:after,.chat_menu .chat_alarm:after{font-size:12px!important}
.chat_menu .chat_alarm:disabled:after{font-size:0!important}
.chat_menu button:before{width:20px!important;height:20px!important;background-size:contain!important;background-repeat:no-repeat!important;background-position:center!important}
#trade_ing:before{content:none!important}
#trade_ing{font-size:13px!important}
#chat_notice_txt .sub_txt{white-space:normal!important;overflow:visible!important;text-overflow:clip!important;line-height:1.4!important}
#chat_content_list .date span{padding:4px 14px!important;font-size:11px!important;background:#c9c9cb!important}
@media(max-width:559px){
  .chat_room .chat_info_wrap{flex-wrap:nowrap!important}
  .chat_info_wrap .chat_info{padding-right:0!important}
  #trade_state_text.trade_state{position:static!important;align-self:flex-end!important}
  .chat_menu_area .chat_menu{display:grid!important;grid-template-columns:1fr 1fr!important;gap:6px!important}
  .chat_menu_area .chat_menu button{min-width:0!important;margin-bottom:0!important}
}
</style>`;
