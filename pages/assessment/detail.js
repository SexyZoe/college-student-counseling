// pages/assessment/detail.js
var questionSets = {"sas": [{"id": 1, "title": "鎴戣寰楁瘮骞虫椂瀹规槗绱у紶鍜岀潃鎬?, "options": [{"label": "A", "text": "娌℃湁鎴栧緢灏戞椂闂?, "score": 1}, {"label": "B", "text": "灏忛儴鍒嗘椂闂?, "score": 2}, {"label": "C", "text": "鐩稿綋澶氭椂闂?, "score": 3}, {"label": "D", "text": "缁濆ぇ閮ㄥ垎鎴栧叏閮ㄦ椂闂?, "score": 4}]}, {"id": 2, "title": "鎴戞棤缂樻棤鏁呭湴鎰熷埌瀹虫€?, "options": [{"label": "A", "text": "娌℃湁鎴栧緢灏戞椂闂?, "score": 1}, {"label": "B", "text": "灏忛儴鍒嗘椂闂?, "score": 2}, {"label": "C", "text": "鐩稿綋澶氭椂闂?, "score": 3}, {"label": "D", "text": "缁濆ぇ閮ㄥ垎鎴栧叏閮ㄦ椂闂?, "score": 4}]}, {"id": 3, "title": "鎴戝鏄撳績閲岀儲涔辨垨瑙夊緱鎯婃亹", "options": [{"label": "A", "text": "娌℃湁鎴栧緢灏戞椂闂?, "score": 1}, {"label": "B", "text": "灏忛儴鍒嗘椂闂?, "score": 2}, {"label": "C", "text": "鐩稿綋澶氭椂闂?, "score": 3}, {"label": "D", "text": "缁濆ぇ閮ㄥ垎鎴栧叏閮ㄦ椂闂?, "score": 4}]}, {"id": 4, "title": "鎴戣寰楁垜鍙兘灏嗚鍙戠柉", "options": [{"label": "A", "text": "娌℃湁鎴栧緢灏戞椂闂?, "score": 1}, {"label": "B", "text": "灏忛儴鍒嗘椂闂?, "score": 2}, {"label": "C", "text": "鐩稿綋澶氭椂闂?, "score": 3}, {"label": "D", "text": "缁濆ぇ閮ㄥ垎鎴栧叏閮ㄦ椂闂?, "score": 4}]}, {"id": 5, "title": "鎴戣寰椾竴鍒囬兘寰堝ソ锛屼篃涓嶄細鍙戠敓浠€涔堜笉骞?, "options": [{"label": "A", "text": "缁濆ぇ閮ㄥ垎鏃堕棿", "score": 4}, {"label": "B", "text": "鐩稿綋澶氭椂闂?, "score": 3}, {"label": "C", "text": "灏忛儴鍒嗘椂闂?, "score": 2}, {"label": "D", "text": "娌℃湁鎴栧緢灏戞椂闂?, "score": 1}]}, {"id": 6, "title": "鎴戞墜鑴氬彂鎶栨墦棰?, "options": [{"label": "A", "text": "娌℃湁鎴栧緢灏戞椂闂?, "score": 1}, {"label": "B", "text": "灏忛儴鍒嗘椂闂?, "score": 2}, {"label": "C", "text": "鐩稿綋澶氭椂闂?, "score": 3}, {"label": "D", "text": "缁濆ぇ閮ㄥ垎鎴栧叏閮ㄦ椂闂?, "score": 4}]}, {"id": 7, "title": "鎴戝洜涓哄ご鐥涖€侀鐥涘拰鑳岀棝鑰岃嫤鎭?, "options": [{"label": "A", "text": "娌℃湁鎴栧緢灏戞椂闂?, "score": 1}, {"label": "B", "text": "灏忛儴鍒嗘椂闂?, "score": 2}, {"label": "C", "text": "鐩稿綋澶氭椂闂?, "score": 3}, {"label": "D", "text": "缁濆ぇ閮ㄥ垎鎴栧叏閮ㄦ椂闂?, "score": 4}]}, {"id": 8, "title": "鎴戞劅瑙夊鏄撹“寮卞拰鐤蹭箯", "options": [{"label": "A", "text": "娌℃湁鎴栧緢灏戞椂闂?, "score": 1}, {"label": "B", "text": "灏忛儴鍒嗘椂闂?, "score": 2}, {"label": "C", "text": "鐩稿綋澶氭椂闂?, "score": 3}, {"label": "D", "text": "缁濆ぇ閮ㄥ垎鎴栧叏閮ㄦ椂闂?, "score": 4}]}, {"id": 9, "title": "鎴戣寰楀績骞虫皵鍜岋紝骞朵笖瀹规槗瀹夐潤鍧愮潃", "options": [{"label": "A", "text": "缁濆ぇ閮ㄥ垎鏃堕棿", "score": 4}, {"label": "B", "text": "鐩稿綋澶氭椂闂?, "score": 3}, {"label": "C", "text": "灏忛儴鍒嗘椂闂?, "score": 2}, {"label": "D", "text": "娌℃湁鎴栧緢灏戞椂闂?, "score": 1}]}, {"id": 10, "title": "鎴戣寰楀績璺冲緱寰堝揩", "options": [{"label": "A", "text": "娌℃湁鎴栧緢灏戞椂闂?, "score": 1}, {"label": "B", "text": "灏忛儴鍒嗘椂闂?, "score": 2}, {"label": "C", "text": "鐩稿綋澶氭椂闂?, "score": 3}, {"label": "D", "text": "缁濆ぇ閮ㄥ垎鎴栧叏閮ㄦ椂闂?, "score": 4}]}, {"id": 11, "title": "鎴戝洜涓轰竴闃甸樀澶存檿鑰岃嫤鎭?, "options": [{"label": "A", "text": "娌℃湁鎴栧緢灏戞椂闂?, "score": 1}, {"label": "B", "text": "灏忛儴鍒嗘椂闂?, "score": 2}, {"label": "C", "text": "鐩稿綋澶氭椂闂?, "score": 3}, {"label": "D", "text": "缁濆ぇ閮ㄥ垎鎴栧叏閮ㄦ椂闂?, "score": 4}]}, {"id": 12, "title": "鎴戞湁鏅曞€掑彂浣滐紝鎴栬寰楄鏅曞€掍技鐨?, "options": [{"label": "A", "text": "娌℃湁鎴栧緢灏戞椂闂?, "score": 1}, {"label": "B", "text": "灏忛儴鍒嗘椂闂?, "score": 2}, {"label": "C", "text": "鐩稿綋澶氭椂闂?, "score": 3}, {"label": "D", "text": "缁濆ぇ閮ㄥ垎鎴栧叏閮ㄦ椂闂?, "score": 4}]}, {"id": 13, "title": "鎴戝惛姘斿懠姘旈兘鎰熷埌寰堝鏄?, "options": [{"label": "A", "text": "缁濆ぇ閮ㄥ垎鏃堕棿", "score": 4}, {"label": "B", "text": "鐩稿綋澶氭椂闂?, "score": 3}, {"label": "C", "text": "灏忛儴鍒嗘椂闂?, "score": 2}, {"label": "D", "text": "娌℃湁鎴栧緢灏戞椂闂?, "score": 1}]}, {"id": 14, "title": "鎴戠殑鎵嬭剼楹绘湪鍜屽埡鐥?, "options": [{"label": "A", "text": "娌℃湁鎴栧緢灏戞椂闂?, "score": 1}, {"label": "B", "text": "灏忛儴鍒嗘椂闂?, "score": 2}, {"label": "C", "text": "鐩稿綋澶氭椂闂?, "score": 3}, {"label": "D", "text": "缁濆ぇ閮ㄥ垎鎴栧叏閮ㄦ椂闂?, "score": 4}]}, {"id": 15, "title": "鎴戝洜涓鸿儍鐥涘拰娑堝寲涓嶈壇鑰岃嫤鎭?, "options": [{"label": "A", "text": "娌℃湁鎴栧緢灏戞椂闂?, "score": 1}, {"label": "B", "text": "灏忛儴鍒嗘椂闂?, "score": 2}, {"label": "C", "text": "鐩稿綋澶氭椂闂?, "score": 3}, {"label": "D", "text": "缁濆ぇ閮ㄥ垎鎴栧叏閮ㄦ椂闂?, "score": 4}]}, {"id": 16, "title": "鎴戝父甯歌灏忎究", "options": [{"label": "A", "text": "娌℃湁鎴栧緢灏戞椂闂?, "score": 1}, {"label": "B", "text": "灏忛儴鍒嗘椂闂?, "score": 2}, {"label": "C", "text": "鐩稿綋澶氭椂闂?, "score": 3}, {"label": "D", "text": "缁濆ぇ閮ㄥ垎鎴栧叏閮ㄦ椂闂?, "score": 4}]}, {"id": 17, "title": "鎴戠殑鎵嬭剼甯稿父鏄共鐕ユ俯鏆栫殑", "options": [{"label": "A", "text": "缁濆ぇ閮ㄥ垎鏃堕棿", "score": 4}, {"label": "B", "text": "鐩稿綋澶氭椂闂?, "score": 3}, {"label": "C", "text": "灏忛儴鍒嗘椂闂?, "score": 2}, {"label": "D", "text": "娌℃湁鎴栧緢灏戞椂闂?, "score": 1}]}, {"id": 18, "title": "鎴戣劯绾㈠彂鐑?, "options": [{"label": "A", "text": "娌℃湁鎴栧緢灏戞椂闂?, "score": 1}, {"label": "B", "text": "灏忛儴鍒嗘椂闂?, "score": 2}, {"label": "C", "text": "鐩稿綋澶氭椂闂?, "score": 3}, {"label": "D", "text": "缁濆ぇ閮ㄥ垎鎴栧叏閮ㄦ椂闂?, "score": 4}]}, {"id": 19, "title": "鎴戝鏄撳叆鐫″苟涓斾竴澶滅潯寰楀緢濂?, "options": [{"label": "A", "text": "缁濆ぇ閮ㄥ垎鏃堕棿", "score": 4}, {"label": "B", "text": "鐩稿綋澶氭椂闂?, "score": 3}, {"label": "C", "text": "灏忛儴鍒嗘椂闂?, "score": 2}, {"label": "D", "text": "娌℃湁鎴栧緢灏戞椂闂?, "score": 1}]}, {"id": 20, "title": "鎴戝仛鍣╂ⅵ", "options": [{"label": "A", "text": "娌℃湁鎴栧緢灏戞椂闂?, "score": 1}, {"label": "B", "text": "灏忛儴鍒嗘椂闂?, "score": 2}, {"label": "C", "text": "鐩稿綋澶氭椂闂?, "score": 3}, {"label": "D", "text": "缁濆ぇ閮ㄥ垎鎴栧叏閮ㄦ椂闂?, "score": 4}]}], "sds": [{"id": 1, "title": "鎴戣寰楅椃闂蜂笉涔愶紝鎯呯华浣庢矇", "options": [{"label": "A", "text": "娌℃湁鎴栧緢灏戞椂闂?, "score": 1}, {"label": "B", "text": "灏忛儴鍒嗘椂闂?, "score": 2}, {"label": "C", "text": "鐩稿綋澶氭椂闂?, "score": 3}, {"label": "D", "text": "缁濆ぇ閮ㄥ垎鎴栧叏閮ㄦ椂闂?, "score": 4}]}, {"id": 2, "title": "鎴戣寰椾竴澶╀箣涓棭鏅ㄦ渶濂?, "options": [{"label": "A", "text": "缁濆ぇ閮ㄥ垎鏃堕棿", "score": 4}, {"label": "B", "text": "鐩稿綋澶氭椂闂?, "score": 3}, {"label": "C", "text": "灏忛儴鍒嗘椂闂?, "score": 2}, {"label": "D", "text": "娌℃湁鎴栧緢灏戞椂闂?, "score": 1}]}, {"id": 3, "title": "鎴戜竴闃甸樀鍝嚭鏉ユ垨瑙夊緱鎯冲摥", "options": [{"label": "A", "text": "娌℃湁鎴栧緢灏戞椂闂?, "score": 1}, {"label": "B", "text": "灏忛儴鍒嗘椂闂?, "score": 2}, {"label": "C", "text": "鐩稿綋澶氭椂闂?, "score": 3}, {"label": "D", "text": "缁濆ぇ閮ㄥ垎鎴栧叏閮ㄦ椂闂?, "score": 4}]}, {"id": 4, "title": "鎴戞櫄涓婄潯鐪犱笉濂?, "options": [{"label": "A", "text": "娌℃湁鎴栧緢灏戞椂闂?, "score": 1}, {"label": "B", "text": "灏忛儴鍒嗘椂闂?, "score": 2}, {"label": "C", "text": "鐩稿綋澶氭椂闂?, "score": 3}, {"label": "D", "text": "缁濆ぇ閮ㄥ垎鎴栧叏閮ㄦ椂闂?, "score": 4}]}, {"id": 5, "title": "鎴戝悆寰楄窡骞冲父涓€鏍峰", "options": [{"label": "A", "text": "缁濆ぇ閮ㄥ垎鏃堕棿", "score": 4}, {"label": "B", "text": "鐩稿綋澶氭椂闂?, "score": 3}, {"label": "C", "text": "灏忛儴鍒嗘椂闂?, "score": 2}, {"label": "D", "text": "娌℃湁鎴栧緢灏戞椂闂?, "score": 1}]}, {"id": 6, "title": "鎴戜笌寮傛€у瘑鍒囨帴瑙︽椂鍜屼互寰€涓€鏍锋劅鍒版剦蹇?, "options": [{"label": "A", "text": "缁濆ぇ閮ㄥ垎鏃堕棿", "score": 4}, {"label": "B", "text": "鐩稿綋澶氭椂闂?, "score": 3}, {"label": "C", "text": "灏忛儴鍒嗘椂闂?, "score": 2}, {"label": "D", "text": "娌℃湁鎴栧緢灏戞椂闂?, "score": 1}]}, {"id": 7, "title": "鎴戝彂瑙夋垜鐨勪綋閲嶅湪涓嬮檷", "options": [{"label": "A", "text": "娌℃湁鎴栧緢灏戞椂闂?, "score": 1}, {"label": "B", "text": "灏忛儴鍒嗘椂闂?, "score": 2}, {"label": "C", "text": "鐩稿綋澶氭椂闂?, "score": 3}, {"label": "D", "text": "缁濆ぇ閮ㄥ垎鎴栧叏閮ㄦ椂闂?, "score": 4}]}, {"id": 8, "title": "鎴戞湁渚跨鐨勮嫤鎭?, "options": [{"label": "A", "text": "娌℃湁鎴栧緢灏戞椂闂?, "score": 1}, {"label": "B", "text": "灏忛儴鍒嗘椂闂?, "score": 2}, {"label": "C", "text": "鐩稿綋澶氭椂闂?, "score": 3}, {"label": "D", "text": "缁濆ぇ閮ㄥ垎鎴栧叏閮ㄦ椂闂?, "score": 4}]}, {"id": 9, "title": "鎴戝績璺虫瘮骞虫椂蹇?, "options": [{"label": "A", "text": "娌℃湁鎴栧緢灏戞椂闂?, "score": 1}, {"label": "B", "text": "灏忛儴鍒嗘椂闂?, "score": 2}, {"label": "C", "text": "鐩稿綋澶氭椂闂?, "score": 3}, {"label": "D", "text": "缁濆ぇ閮ㄥ垎鎴栧叏閮ㄦ椂闂?, "score": 4}]}, {"id": 10, "title": "鎴戞棤缂樻棤鏁呭湴鎰熷埌鐤蹭箯", "options": [{"label": "A", "text": "娌℃湁鎴栧緢灏戞椂闂?, "score": 1}, {"label": "B", "text": "灏忛儴鍒嗘椂闂?, "score": 2}, {"label": "C", "text": "鐩稿綋澶氭椂闂?, "score": 3}, {"label": "D", "text": "缁濆ぇ閮ㄥ垎鎴栧叏閮ㄦ椂闂?, "score": 4}]}, {"id": 11, "title": "鎴戠殑澶磋剳璺熷钩甯镐竴鏍锋竻妤?, "options": [{"label": "A", "text": "缁濆ぇ閮ㄥ垎鏃堕棿", "score": 4}, {"label": "B", "text": "鐩稿綋澶氭椂闂?, "score": 3}, {"label": "C", "text": "灏忛儴鍒嗘椂闂?, "score": 2}, {"label": "D", "text": "娌℃湁鎴栧緢灏戞椂闂?, "score": 1}]}, {"id": 12, "title": "鎴戣寰楃粡甯稿仛鐨勪簨鎯呭苟娌℃湁鍥伴毦", "options": [{"label": "A", "text": "缁濆ぇ閮ㄥ垎鏃堕棿", "score": 4}, {"label": "B", "text": "鐩稿綋澶氭椂闂?, "score": 3}, {"label": "C", "text": "灏忛儴鍒嗘椂闂?, "score": 2}, {"label": "D", "text": "娌℃湁鎴栧緢灏戞椂闂?, "score": 1}]}, {"id": 13, "title": "鎴戣寰椾笉瀹夎€屽钩闈欎笉涓嬫潵", "options": [{"label": "A", "text": "娌℃湁鎴栧緢灏戞椂闂?, "score": 1}, {"label": "B", "text": "灏忛儴鍒嗘椂闂?, "score": 2}, {"label": "C", "text": "鐩稿綋澶氭椂闂?, "score": 3}, {"label": "D", "text": "缁濆ぇ閮ㄥ垎鎴栧叏閮ㄦ椂闂?, "score": 4}]}, {"id": 14, "title": "鎴戝灏嗘潵鎶辨湁甯屾湜", "options": [{"label": "A", "text": "缁濆ぇ閮ㄥ垎鏃堕棿", "score": 4}, {"label": "B", "text": "鐩稿綋澶氭椂闂?, "score": 3}, {"label": "C", "text": "灏忛儴鍒嗘椂闂?, "score": 2}, {"label": "D", "text": "娌℃湁鎴栧緢灏戞椂闂?, "score": 1}]}, {"id": 15, "title": "鎴戞瘮骞冲父瀹规槗鐢熸皵婵€鍔?, "options": [{"label": "A", "text": "娌℃湁鎴栧緢灏戞椂闂?, "score": 1}, {"label": "B", "text": "灏忛儴鍒嗘椂闂?, "score": 2}, {"label": "C", "text": "鐩稿綋澶氭椂闂?, "score": 3}, {"label": "D", "text": "缁濆ぇ閮ㄥ垎鎴栧叏閮ㄦ椂闂?, "score": 4}]}, {"id": 16, "title": "鎴戣寰椾綔鍑哄喅瀹氭槸瀹规槗鐨?, "options": [{"label": "A", "text": "缁濆ぇ閮ㄥ垎鏃堕棿", "score": 4}, {"label": "B", "text": "鐩稿綋澶氭椂闂?, "score": 3}, {"label": "C", "text": "灏忛儴鍒嗘椂闂?, "score": 2}, {"label": "D", "text": "娌℃湁鎴栧緢灏戞椂闂?, "score": 1}]}, {"id": 17, "title": "鎴戣寰楄嚜宸辨槸涓湁鐢ㄧ殑浜猴紝鏈変汉闇€瑕佹垜", "options": [{"label": "A", "text": "缁濆ぇ閮ㄥ垎鏃堕棿", "score": 4}, {"label": "B", "text": "鐩稿綋澶氭椂闂?, "score": 3}, {"label": "C", "text": "灏忛儴鍒嗘椂闂?, "score": 2}, {"label": "D", "text": "娌℃湁鎴栧緢灏戞椂闂?, "score": 1}]}, {"id": 18, "title": "鎴戠殑鐢熸椿杩囧緱寰堟湁鎰忔€?, "options": [{"label": "A", "text": "缁濆ぇ閮ㄥ垎鏃堕棿", "score": 4}, {"label": "B", "text": "鐩稿綋澶氭椂闂?, "score": 3}, {"label": "C", "text": "灏忛儴鍒嗘椂闂?, "score": 2}, {"label": "D", "text": "娌℃湁鎴栧緢灏戞椂闂?, "score": 1}]}, {"id": 19, "title": "鎴戣涓哄鏋滄垜姝讳簡鍒汉浼氱敓娲诲緱濂戒簺", "options": [{"label": "A", "text": "娌℃湁鎴栧緢灏戞椂闂?, "score": 1}, {"label": "B", "text": "灏忛儴鍒嗘椂闂?, "score": 2}, {"label": "C", "text": "鐩稿綋澶氭椂闂?, "score": 3}, {"label": "D", "text": "缁濆ぇ閮ㄥ垎鎴栧叏閮ㄦ椂闂?, "score": 4}]}, {"id": 20, "title": "骞冲父鎰熷叴瓒ｇ殑浜嬫垜浠嶇劧鐓ф牱鎰熷叴瓒?, "options": [{"label": "A", "text": "缁濆ぇ閮ㄥ垎鏃堕棿", "score": 4}, {"label": "B", "text": "鐩稿綋澶氭椂闂?, "score": 3}, {"label": "C", "text": "灏忛儴鍒嗘椂闂?, "score": 2}, {"label": "D", "text": "娌℃湁鎴栧緢灏戞椂闂?, "score": 1}]}], "stress": [{"id": 1, "title": "鎴戝洜涓鸿绋嬮毦搴﹁繃澶ц€屾劅鍒板帇鍔?, "options": [{"label": "A", "text": "瀹屽叏涓嶇鍚?, "score": 1}, {"label": "B", "text": "姣旇緝涓嶇鍚?, "score": 2}, {"label": "C", "text": "姣旇緝绗﹀悎", "score": 3}, {"label": "D", "text": "瀹屽叏绗﹀悎", "score": 4}]}, {"id": 2, "title": "鎴戝鑰冭瘯缁撴灉鎰熷埌杩囧害鎷呭咖", "options": [{"label": "A", "text": "瀹屽叏涓嶇鍚?, "score": 1}, {"label": "B", "text": "姣旇緝涓嶇鍚?, "score": 2}, {"label": "C", "text": "姣旇緝绗﹀悎", "score": 3}, {"label": "D", "text": "瀹屽叏绗﹀悎", "score": 4}]}, {"id": 3, "title": "鎴戦毦浠ラ泦涓敞鎰忓姏瀹屾垚瀛︿笟浠诲姟", "options": [{"label": "A", "text": "瀹屽叏涓嶇鍚?, "score": 1}, {"label": "B", "text": "姣旇緝涓嶇鍚?, "score": 2}, {"label": "C", "text": "姣旇緝绗﹀悎", "score": 3}, {"label": "D", "text": "瀹屽叏绗﹀悎", "score": 4}]}, {"id": 4, "title": "鎴戝洜涓轰綔涓?璁烘枃鎴鏃ユ湡鑰屾劅鍒板帇鍔涘緢澶?, "options": [{"label": "A", "text": "瀹屽叏涓嶇鍚?, "score": 1}, {"label": "B", "text": "姣旇緝涓嶇鍚?, "score": 2}, {"label": "C", "text": "姣旇緝绗﹀悎", "score": 3}, {"label": "D", "text": "瀹屽叏绗﹀悎", "score": 4}]}, {"id": 5, "title": "鎴戣寰楄嚜宸辩殑瀛︿範鏁堢巼涓嶅鍚屽", "options": [{"label": "A", "text": "瀹屽叏涓嶇鍚?, "score": 1}, {"label": "B", "text": "姣旇緝涓嶇鍚?, "score": 2}, {"label": "C", "text": "姣旇緝绗﹀悎", "score": 3}, {"label": "D", "text": "瀹屽叏绗﹀悎", "score": 4}]}, {"id": 6, "title": "涓轰簡搴斿瀛︿笟锛屾垜缁忓父鐔", "options": [{"label": "A", "text": "瀹屽叏涓嶇鍚?, "score": 1}, {"label": "B", "text": "姣旇緝涓嶇鍚?, "score": 2}, {"label": "C", "text": "姣旇緝绗﹀悎", "score": 3}, {"label": "D", "text": "瀹屽叏绗﹀悎", "score": 4}]}, {"id": 7, "title": "鎴戝鑷繁鐨勪笓涓氭柟鍚戞劅鍒拌糠鑼?, "options": [{"label": "A", "text": "瀹屽叏涓嶇鍚?, "score": 1}, {"label": "B", "text": "姣旇緝涓嶇鍚?, "score": 2}, {"label": "C", "text": "姣旇緝绗﹀悎", "score": 3}, {"label": "D", "text": "瀹屽叏绗﹀悎", "score": 4}]}, {"id": 8, "title": "瀹堕暱鐨勬湡鏈涚粰鎴戝甫鏉ュ帇鍔?, "options": [{"label": "A", "text": "瀹屽叏涓嶇鍚?, "score": 1}, {"label": "B", "text": "姣旇緝涓嶇鍚?, "score": 2}, {"label": "C", "text": "姣旇緝绗﹀悎", "score": 3}, {"label": "D", "text": "瀹屽叏绗﹀悎", "score": 4}]}, {"id": 9, "title": "鎴戝洜涓哄涔犳斁寮冧簡寰堝濞变箰娲诲姩", "options": [{"label": "A", "text": "瀹屽叏涓嶇鍚?, "score": 1}, {"label": "B", "text": "姣旇緝涓嶇鍚?, "score": 2}, {"label": "C", "text": "姣旇緝绗﹀悎", "score": 3}, {"label": "D", "text": "瀹屽叏绗﹀悎", "score": 4}]}, {"id": 10, "title": "鎯冲埌瀛︿笟鎴戝氨鎰熷埌蹇冭烦鍔犻€熸垨涓嶅畨", "options": [{"label": "A", "text": "瀹屽叏涓嶇鍚?, "score": 1}, {"label": "B", "text": "姣旇緝涓嶇鍚?, "score": 2}, {"label": "C", "text": "姣旇緝绗﹀悎", "score": 3}, {"label": "D", "text": "瀹屽叏绗﹀悎", "score": 4}]}, {"id": 11, "title": "鎴戝瀛︿範鎴愮哗鎰熷埌婊℃剰", "options": [{"label": "A", "text": "瀹屽叏绗﹀悎", "score": 4}, {"label": "B", "text": "姣旇緝绗﹀悎", "score": 3}, {"label": "C", "text": "姣旇緝涓嶇鍚?, "score": 2}, {"label": "D", "text": "瀹屽叏涓嶇鍚?, "score": 1}]}, {"id": 12, "title": "鎴戣兘鍚堢悊瀹夋帓瀛︿範鍜屼紤鎭椂闂?, "options": [{"label": "A", "text": "瀹屽叏绗﹀悎", "score": 4}, {"label": "B", "text": "姣旇緝绗﹀悎", "score": 3}, {"label": "C", "text": "姣旇緝涓嶇鍚?, "score": 2}, {"label": "D", "text": "瀹屽叏涓嶇鍚?, "score": 1}]}, {"id": 13, "title": "閬囧埌瀛︿笟鍥伴毦鏃舵垜浼氫富鍔ㄥ姹傚府鍔?, "options": [{"label": "A", "text": "瀹屽叏绗﹀悎", "score": 4}, {"label": "B", "text": "姣旇緝绗﹀悎", "score": 3}, {"label": "C", "text": "姣旇緝涓嶇鍚?, "score": 2}, {"label": "D", "text": "瀹屽叏涓嶇鍚?, "score": 1}]}, {"id": 14, "title": "鎴戝洜涓哄涓氬帇鍔涘奖鍝嶄簡鐫＄湢璐ㄩ噺", "options": [{"label": "A", "text": "瀹屽叏涓嶇鍚?, "score": 1}, {"label": "B", "text": "姣旇緝涓嶇鍚?, "score": 2}, {"label": "C", "text": "姣旇緝绗﹀悎", "score": 3}, {"label": "D", "text": "瀹屽叏绗﹀悎", "score": 4}]}, {"id": 15, "title": "瀛︿笟鍘嬪姏璁╂垜鎰熷埌韬績淇辩柌", "options": [{"label": "A", "text": "瀹屽叏涓嶇鍚?, "score": 1}, {"label": "B", "text": "姣旇緝涓嶇鍚?, "score": 2}, {"label": "C", "text": "姣旇緝绗﹀悎", "score": 3}, {"label": "D", "text": "瀹屽叏绗﹀悎", "score": 4}]}], "relate": [{"id": 1, "title": "鍦ㄧぞ浜ゅ満鍚堜腑锛屾垜鎰熷埌绱у紶鍜屼笉鑷湪", "options": [{"label": "A", "text": "瀹屽叏涓嶇鍚?, "score": 1}, {"label": "B", "text": "姣旇緝涓嶇鍚?, "score": 2}, {"label": "C", "text": "姣旇緝绗﹀悎", "score": 3}, {"label": "D", "text": "瀹屽叏绗﹀悎", "score": 4}]}, {"id": 2, "title": "鎴戝緢闅句富鍔ㄤ笌闄岀敓浜轰氦璋?, "options": [{"label": "A", "text": "瀹屽叏涓嶇鍚?, "score": 1}, {"label": "B", "text": "姣旇緝涓嶇鍚?, "score": 2}, {"label": "C", "text": "姣旇緝绗﹀悎", "score": 3}, {"label": "D", "text": "瀹屽叏绗﹀悎", "score": 4}]}, {"id": 3, "title": "鎴戞媴蹇冨埆浜哄鎴戜笉婊℃剰", "options": [{"label": "A", "text": "瀹屽叏涓嶇鍚?, "score": 1}, {"label": "B", "text": "姣旇緝涓嶇鍚?, "score": 2}, {"label": "C", "text": "姣旇緝绗﹀悎", "score": 3}, {"label": "D", "text": "瀹屽叏绗﹀悎", "score": 4}]}, {"id": 4, "title": "鎴戣涓鸿嚜宸卞鏄撹浠栦汉璇В", "options": [{"label": "A", "text": "瀹屽叏涓嶇鍚?, "score": 1}, {"label": "B", "text": "姣旇緝涓嶇鍚?, "score": 2}, {"label": "C", "text": "姣旇緝绗﹀悎", "score": 3}, {"label": "D", "text": "瀹屽叏绗﹀悎", "score": 4}]}, {"id": 5, "title": "涓庡鍙?鍚屽鐩稿鏃讹紝鎴戠粡甯告劅鍒板洶鎵?, "options": [{"label": "A", "text": "瀹屽叏涓嶇鍚?, "score": 1}, {"label": "B", "text": "姣旇緝涓嶇鍚?, "score": 2}, {"label": "C", "text": "姣旇緝绗﹀悎", "score": 3}, {"label": "D", "text": "瀹屽叏绗﹀悎", "score": 4}]}, {"id": 6, "title": "鎴戝緢闅炬嫆缁濆埆浜虹殑璇锋眰", "options": [{"label": "A", "text": "瀹屽叏涓嶇鍚?, "score": 1}, {"label": "B", "text": "姣旇緝涓嶇鍚?, "score": 2}, {"label": "C", "text": "姣旇緝绗﹀悎", "score": 3}, {"label": "D", "text": "瀹屽叏绗﹀悎", "score": 4}]}, {"id": 7, "title": "鎴戣寰楄嚜宸辨湁鍑犱釜鐪熸鐞嗚В鎴戠殑鏈嬪弸", "options": [{"label": "A", "text": "瀹屽叏绗﹀悎", "score": 4}, {"label": "B", "text": "姣旇緝绗﹀悎", "score": 3}, {"label": "C", "text": "姣旇緝涓嶇鍚?, "score": 2}, {"label": "D", "text": "瀹屽叏涓嶇鍚?, "score": 1}]}, {"id": 8, "title": "鎴戝湪鍥㈤槦涓兘澶熻嚜濡傚湴琛ㄨ揪瑙傜偣", "options": [{"label": "A", "text": "瀹屽叏绗﹀悎", "score": 4}, {"label": "B", "text": "姣旇緝绗﹀悎", "score": 3}, {"label": "C", "text": "姣旇緝涓嶇鍚?, "score": 2}, {"label": "D", "text": "瀹屽叏涓嶇鍚?, "score": 1}]}, {"id": 9, "title": "浜洪檯鍐茬獊鍚庢垜鑳戒富鍔ㄤ慨澶嶅叧绯?, "options": [{"label": "A", "text": "瀹屽叏绗﹀悎", "score": 4}, {"label": "B", "text": "姣旇緝绗﹀悎", "score": 3}, {"label": "C", "text": "姣旇緝涓嶇鍚?, "score": 2}, {"label": "D", "text": "瀹屽叏涓嶇鍚?, "score": 1}]}, {"id": 10, "title": "鎴戠粡甯告劅鍒板鐙紝鍗充娇鍛ㄥ洿鏈夊緢澶氫汉", "options": [{"label": "A", "text": "瀹屽叏涓嶇鍚?, "score": 1}, {"label": "B", "text": "姣旇緝涓嶇鍚?, "score": 2}, {"label": "C", "text": "姣旇緝绗﹀悎", "score": 3}, {"label": "D", "text": "瀹屽叏绗﹀悎", "score": 4}]}, {"id": 11, "title": "鎴戝鎬曞湪鍏紑鍦哄悎琚壒璇勬垨璇勪环", "options": [{"label": "A", "text": "瀹屽叏涓嶇鍚?, "score": 1}, {"label": "B", "text": "姣旇緝涓嶇鍚?, "score": 2}, {"label": "C", "text": "姣旇緝绗﹀悎", "score": 3}, {"label": "D", "text": "瀹屽叏绗﹀悎", "score": 4}]}, {"id": 12, "title": "涓庝汉浜ゅ線鏃舵垜杩囧垎鍦ㄦ剰鑷繁鐨勮█琛?, "options": [{"label": "A", "text": "瀹屽叏涓嶇鍚?, "score": 1}, {"label": "B", "text": "姣旇緝涓嶇鍚?, "score": 2}, {"label": "C", "text": "姣旇緝绗﹀悎", "score": 3}, {"label": "D", "text": "瀹屽叏绗﹀悎", "score": 4}]}, {"id": 13, "title": "鎴戜韩鍙椾笌鏈嬪弸涓€璧峰害杩囩殑鏃跺厜", "options": [{"label": "A", "text": "瀹屽叏绗﹀悎", "score": 4}, {"label": "B", "text": "姣旇緝绗﹀悎", "score": 3}, {"label": "C", "text": "姣旇緝涓嶇鍚?, "score": 2}, {"label": "D", "text": "瀹屽叏涓嶇鍚?, "score": 1}]}, {"id": 14, "title": "鎴戠粡甯镐富鍔ㄨ仈绯诲浜烘垨鑰佹湅鍙?, "options": [{"label": "A", "text": "瀹屽叏绗﹀悎", "score": 4}, {"label": "B", "text": "姣旇緝绗﹀悎", "score": 3}, {"label": "C", "text": "姣旇緝涓嶇鍚?, "score": 2}, {"label": "D", "text": "瀹屽叏涓嶇鍚?, "score": 1}]}, {"id": 15, "title": "浜洪檯鍏崇郴闂褰卞搷浜嗘垜鐨勫涔犲拰鐢熸椿", "options": [{"label": "A", "text": "瀹屽叏涓嶇鍚?, "score": 1}, {"label": "B", "text": "姣旇緝涓嶇鍚?, "score": 2}, {"label": "C", "text": "姣旇緝绗﹀悎", "score": 3}, {"label": "D", "text": "瀹屽叏绗﹀悎", "score": 4}]}], "emotion": [{"id": 1, "title": "鎴戣兘娓呮鍦拌瘑鍒嚜宸卞綋鍓嶇殑鎯呯华鐘舵€?, "options": [{"label": "A", "text": "瀹屽叏涓嶇鍚?, "score": 1}, {"label": "B", "text": "姣旇緝涓嶇鍚?, "score": 2}, {"label": "C", "text": "姣旇緝绗﹀悎", "score": 3}, {"label": "D", "text": "瀹屽叏绗﹀悎", "score": 4}]}, {"id": 2, "title": "褰撴儏缁綆钀芥椂鎴戠煡閬撳師鍥犳槸浠€涔?, "options": [{"label": "A", "text": "瀹屽叏涓嶇鍚?, "score": 1}, {"label": "B", "text": "姣旇緝涓嶇鍚?, "score": 2}, {"label": "C", "text": "姣旇緝绗﹀悎", "score": 3}, {"label": "D", "text": "瀹屽叏绗﹀悎", "score": 4}]}, {"id": 3, "title": "鎰ゆ€掓椂鎴戣兘澶熸帶鍒惰嚜宸变笉鍋氬啿鍔ㄧ殑琛屼负", "options": [{"label": "A", "text": "瀹屽叏涓嶇鍚?, "score": 1}, {"label": "B", "text": "姣旇緝涓嶇鍚?, "score": 2}, {"label": "C", "text": "姣旇緝绗﹀悎", "score": 3}, {"label": "D", "text": "瀹屽叏绗﹀悎", "score": 4}]}, {"id": 4, "title": "閬囧埌鎸姌鎴戣兘寰堝揩璋冩暣蹇冩€?, "options": [{"label": "A", "text": "瀹屽叏涓嶇鍚?, "score": 1}, {"label": "B", "text": "姣旇緝涓嶇鍚?, "score": 2}, {"label": "C", "text": "姣旇緝绗﹀悎", "score": 3}, {"label": "D", "text": "瀹屽叏绗﹀悎", "score": 4}]}, {"id": 5, "title": "鎴戣兘鐢ㄥ仴搴风殑鏂瑰紡锛堝杩愬姩銆佸€捐瘔锛夋帓瑙ｅ帇鍔?, "options": [{"label": "A", "text": "瀹屽叏涓嶇鍚?, "score": 1}, {"label": "B", "text": "姣旇緝涓嶇鍚?, "score": 2}, {"label": "C", "text": "姣旇緝绗﹀悎", "score": 3}, {"label": "D", "text": "瀹屽叏绗﹀悎", "score": 4}]}, {"id": 6, "title": "璐熼潰鎯呯华鏉ヤ复鏃讹紝鎴戜細琚畠闀挎椂闂村洶鎵?, "options": [{"label": "A", "text": "瀹屽叏绗﹀悎", "score": 4}, {"label": "B", "text": "姣旇緝绗﹀悎", "score": 3}, {"label": "C", "text": "姣旇緝涓嶇鍚?, "score": 2}, {"label": "D", "text": "瀹屽叏涓嶇鍚?, "score": 1}]}, {"id": 7, "title": "鎴戜細鍥犱负浠栦汉鐨勬儏缁€岃繃搴﹀奖鍝嶈嚜宸?, "options": [{"label": "A", "text": "瀹屽叏绗﹀悎", "score": 4}, {"label": "B", "text": "姣旇緝绗﹀悎", "score": 3}, {"label": "C", "text": "姣旇緝涓嶇鍚?, "score": 2}, {"label": "D", "text": "瀹屽叏涓嶇鍚?, "score": 1}]}, {"id": 8, "title": "鎴戠粡甯哥粌涔犳蹇垫垨鍐ユ兂", "options": [{"label": "A", "text": "瀹屽叏涓嶇鍚?, "score": 1}, {"label": "B", "text": "姣旇緝涓嶇鍚?, "score": 2}, {"label": "C", "text": "姣旇緝绗﹀悎", "score": 3}, {"label": "D", "text": "瀹屽叏绗﹀悎", "score": 4}]}, {"id": 9, "title": "鎴戣兘鎺ョ撼鑷繁鐨勮礋闈㈡儏缁€屼笉鎰熷埌鑷矗", "options": [{"label": "A", "text": "瀹屽叏涓嶇鍚?, "score": 1}, {"label": "B", "text": "姣旇緝涓嶇鍚?, "score": 2}, {"label": "C", "text": "姣旇緝绗﹀悎", "score": 3}, {"label": "D", "text": "瀹屽叏绗﹀悎", "score": 4}]}, {"id": 10, "title": "鎯呯华娉㈠姩涓嶄細鏄捐憲褰卞搷鎴戠殑瀛︿範鏁堢巼", "options": [{"label": "A", "text": "瀹屽叏涓嶇鍚?, "score": 1}, {"label": "B", "text": "姣旇緝涓嶇鍚?, "score": 2}, {"label": "C", "text": "姣旇緝绗﹀悎", "score": 3}, {"label": "D", "text": "瀹屽叏绗﹀悎", "score": 4}]}, {"id": 11, "title": "褰撴湅鍙嬫儏缁笉濂芥椂锛屾垜鑳界粰浜堟湁鏁堟敮鎸?, "options": [{"label": "A", "text": "瀹屽叏涓嶇鍚?, "score": 1}, {"label": "B", "text": "姣旇緝涓嶇鍚?, "score": 2}, {"label": "C", "text": "姣旇緝绗﹀悎", "score": 3}, {"label": "D", "text": "瀹屽叏绗﹀悎", "score": 4}]}, {"id": 12, "title": "鎴戠浉淇¤嚜宸辩殑鎯呯华绠＄悊鑳藉姏鍦ㄤ笉鏂彁鍗?, "options": [{"label": "A", "text": "瀹屽叏涓嶇鍚?, "score": 1}, {"label": "B", "text": "姣旇緝涓嶇鍚?, "score": 2}, {"label": "C", "text": "姣旇緝绗﹀悎", "score": 3}, {"label": "D", "text": "瀹屽叏绗﹀悎", "score": 4}]}], "self_esteem": [{"id": 1, "title": "鎴戞劅鍒版垜鏄竴涓湁浠峰€肩殑浜猴紝鑷冲皯涓庡叾浠栦汉鍦ㄥ悓涓€姘村钩涓?, "options": [{"label": "A", "text": "闈炲父涓嶅悓鎰?, "score": 1}, {"label": "B", "text": "涓嶅悓鎰?, "score": 2}, {"label": "C", "text": "鍚屾剰", "score": 3}, {"label": "D", "text": "闈炲父鍚屾剰", "score": 4}]}, {"id": 2, "title": "鎴戞劅鍒版垜鏈夎澶氬ソ鐨勫搧璐?, "options": [{"label": "A", "text": "闈炲父涓嶅悓鎰?, "score": 1}, {"label": "B", "text": "涓嶅悓鎰?, "score": 2}, {"label": "C", "text": "鍚屾剰", "score": 3}, {"label": "D", "text": "闈炲父鍚屾剰", "score": 4}]}, {"id": 3, "title": "褰掓牴缁撳簳锛屾垜鍊惧悜浜庤寰楄嚜宸辨槸涓€涓け璐ヨ€?, "options": [{"label": "A", "text": "闈炲父鍚屾剰", "score": 4}, {"label": "B", "text": "鍚屾剰", "score": 3}, {"label": "C", "text": "涓嶅悓鎰?, "score": 2}, {"label": "D", "text": "闈炲父涓嶅悓鎰?, "score": 1}]}, {"id": 4, "title": "鎴戣兘鍍忓ぇ澶氭暟浜轰竴鏍锋妸浜嬫儏鍋氬ソ", "options": [{"label": "A", "text": "闈炲父涓嶅悓鎰?, "score": 1}, {"label": "B", "text": "涓嶅悓鎰?, "score": 2}, {"label": "C", "text": "鍚屾剰", "score": 3}, {"label": "D", "text": "闈炲父鍚屾剰", "score": 4}]}, {"id": 5, "title": "鎴戞劅鍒拌嚜宸卞€煎緱鑷豹鐨勫湴鏂逛笉澶?, "options": [{"label": "A", "text": "闈炲父鍚屾剰", "score": 4}, {"label": "B", "text": "鍚屾剰", "score": 3}, {"label": "C", "text": "涓嶅悓鎰?, "score": 2}, {"label": "D", "text": "闈炲父涓嶅悓鎰?, "score": 1}]}, {"id": 6, "title": "鎴戝鑷繁鎸佽偗瀹氭€佸害", "options": [{"label": "A", "text": "闈炲父涓嶅悓鎰?, "score": 1}, {"label": "B", "text": "涓嶅悓鎰?, "score": 2}, {"label": "C", "text": "鍚屾剰", "score": 3}, {"label": "D", "text": "闈炲父鍚屾剰", "score": 4}]}, {"id": 7, "title": "鎬荤殑鏉ヨ锛屾垜瀵硅嚜宸辨槸婊℃剰鐨?, "options": [{"label": "A", "text": "闈炲父涓嶅悓鎰?, "score": 1}, {"label": "B", "text": "涓嶅悓鎰?, "score": 2}, {"label": "C", "text": "鍚屾剰", "score": 3}, {"label": "D", "text": "闈炲父鍚屾剰", "score": 4}]}, {"id": 8, "title": "鎴戣鏄兘鏇寸湅寰楄捣鑷繁灏卞ソ浜?, "options": [{"label": "A", "text": "闈炲父鍚屾剰", "score": 4}, {"label": "B", "text": "鍚屾剰", "score": 3}, {"label": "C", "text": "涓嶅悓鎰?, "score": 2}, {"label": "D", "text": "闈炲父涓嶅悓鎰?, "score": 1}]}, {"id": 9, "title": "鎴戠‘瀹炴椂甯告劅鍒拌嚜宸辨鏃犵敤澶?, "options": [{"label": "A", "text": "闈炲父鍚屾剰", "score": 4}, {"label": "B", "text": "鍚屾剰", "score": 3}, {"label": "C", "text": "涓嶅悓鎰?, "score": 2}, {"label": "D", "text": "闈炲父涓嶅悓鎰?, "score": 1}]}, {"id": 10, "title": "鎴戞椂甯歌涓鸿嚜宸变竴鏃犳槸澶?, "options": [{"label": "A", "text": "闈炲父鍚屾剰", "score": 4}, {"label": "B", "text": "鍚屾剰", "score": 3}, {"label": "C", "text": "涓嶅悓鎰?, "score": 2}, {"label": "D", "text": "闈炲父涓嶅悓鎰?, "score": 1}]}], "sleep": [{"id": 1, "title": "杩戜竴鏈堬紝浣犻€氬父鏅氫笂鍑犵偣涓婂簥鐫¤锛?, "options": [{"label": "A", "text": "22:00涔嬪墠", "score": 1}, {"label": "B", "text": "22:00-23:00", "score": 2}, {"label": "C", "text": "23:00-0:00", "score": 3}, {"label": "D", "text": "0:00涔嬪悗", "score": 4}]}, {"id": 2, "title": "杩戜竴鏈堬紝浣犱粠涓婂簥鍒板叆鐫￠€氬父闇€瑕佸闀挎椂闂?, "options": [{"label": "A", "text": "灏忎簬15鍒嗛挓", "score": 1}, {"label": "B", "text": "15-30鍒嗛挓", "score": 2}, {"label": "C", "text": "30-60鍒嗛挓", "score": 3}, {"label": "D", "text": "瓒呰繃60鍒嗛挓", "score": 4}]}, {"id": 3, "title": "杩戜竴鏈堬紝浣犻€氬父鏃╀笂鍑犵偣璧峰簥", "options": [{"label": "A", "text": "6:00涔嬪墠", "score": 1}, {"label": "B", "text": "6:00-7:00", "score": 2}, {"label": "C", "text": "7:00-8:00", "score": 3}, {"label": "D", "text": "8:00涔嬪悗", "score": 4}]}, {"id": 4, "title": "杩戜竴鏈堬紝浣犳瘡鏅氬疄闄呯潯鐪犳椂闂寸害涓?, "options": [{"label": "A", "text": "澶т簬7灏忔椂", "score": 1}, {"label": "B", "text": "6-7灏忔椂", "score": 2}, {"label": "C", "text": "5-6灏忔椂", "score": 3}, {"label": "D", "text": "灏戜簬5灏忔椂", "score": 4}]}, {"id": 5, "title": "杩戜竴鏈堬紝浣犳槸鍚﹀洜涓恒€屽叆鐫″洶闅俱€嶈€屽奖鍝嶇潯鐪?, "options": [{"label": "A", "text": "鏃?, "score": 1}, {"label": "B", "text": "姣忓懆灏戜簬1娆?, "score": 2}, {"label": "C", "text": "姣忓懆1-2娆?, "score": 3}, {"label": "D", "text": "姣忓懆3娆′互涓?, "score": 4}]}, {"id": 6, "title": "杩戜竴鏈堬紝浣犳槸鍚﹀洜涓恒€屽闂存槗閱掓垨鏃╅啋銆嶈€屽奖鍝嶇潯鐪?, "options": [{"label": "A", "text": "鏃?, "score": 1}, {"label": "B", "text": "姣忓懆灏戜簬1娆?, "score": 2}, {"label": "C", "text": "姣忓懆1-2娆?, "score": 3}, {"label": "D", "text": "姣忓懆3娆′互涓?, "score": 4}]}, {"id": 7, "title": "杩戜竴鏈堬紝浣犳槸鍚﹀洜涓恒€屽闂村幓鍘曟墍銆嶈€屽奖鍝嶇潯鐪?, "options": [{"label": "A", "text": "鏃?, "score": 1}, {"label": "B", "text": "姣忓懆灏戜簬1娆?, "score": 2}, {"label": "C", "text": "姣忓懆1-2娆?, "score": 3}, {"label": "D", "text": "姣忓懆3娆′互涓?, "score": 4}]}, {"id": 8, "title": "杩戜竴鏈堬紝浣犳槸鍚﹀洜涓恒€屽仛鍣╂ⅵ銆嶈€屽奖鍝嶇潯鐪?, "options": [{"label": "A", "text": "鏃?, "score": 1}, {"label": "B", "text": "姣忓懆灏戜簬1娆?, "score": 2}, {"label": "C", "text": "姣忓懆1-2娆?, "score": 3}, {"label": "D", "text": "姣忓懆3娆′互涓?, "score": 4}]}, {"id": 9, "title": "杩戜竴鏈堬紝浣犳槸鍚﹂渶瑕佷娇鐢ㄨ嵂鐗╁姪鐪?, "options": [{"label": "A", "text": "鏃?, "score": 1}, {"label": "B", "text": "姣忓懆灏戜簬1娆?, "score": 2}, {"label": "C", "text": "姣忓懆1-2娆?, "score": 3}, {"label": "D", "text": "姣忓懆3娆′互涓?, "score": 4}]}, {"id": 10, "title": "杩戜竴鏈堬紝浣犲浣曡瘎浠疯嚜宸辩殑鏁翠綋鐫＄湢璐ㄩ噺", "options": [{"label": "A", "text": "寰堝ソ", "score": 1}, {"label": "B", "text": "杈冨ソ", "score": 2}, {"label": "C", "text": "杈冨樊", "score": 3}, {"label": "D", "text": "寰堝樊", "score": 4}]}], "resilience": [{"id": 1, "title": "鎴戣兘澶熼€傚簲鐢熸椿涓殑鍙樺寲", "options": [{"label": "A", "text": "瀹屽叏涓嶇鍚?, "score": 1}, {"label": "B", "text": "姣旇緝涓嶇鍚?, "score": 2}, {"label": "C", "text": "姣旇緝绗﹀悎", "score": 3}, {"label": "D", "text": "瀹屽叏绗﹀悎", "score": 4}]}, {"id": 2, "title": "闈㈠鍘嬪姏浜嬩欢锛屾垜鑳戒繚鎸佸喎闈欏拰涓撴敞", "options": [{"label": "A", "text": "瀹屽叏涓嶇鍚?, "score": 1}, {"label": "B", "text": "姣旇緝涓嶇鍚?, "score": 2}, {"label": "C", "text": "姣旇緝绗﹀悎", "score": 3}, {"label": "D", "text": "瀹屽叏绗﹀悎", "score": 4}]}, {"id": 3, "title": "鎴戠浉淇¤嚜宸辨湁鑳藉姏鍏嬫湇鍥伴毦", "options": [{"label": "A", "text": "瀹屽叏涓嶇鍚?, "score": 1}, {"label": "B", "text": "姣旇緝涓嶇鍚?, "score": 2}, {"label": "C", "text": "姣旇緝绗﹀悎", "score": 3}, {"label": "D", "text": "瀹屽叏绗﹀悎", "score": 4}]}, {"id": 4, "title": "鍗充娇浜嬫儏鐪嬭捣鏉ユ棤鏈涳紝鎴戜篃涓嶄細杞绘槗鏀惧純", "options": [{"label": "A", "text": "瀹屽叏涓嶇鍚?, "score": 1}, {"label": "B", "text": "姣旇緝涓嶇鍚?, "score": 2}, {"label": "C", "text": "姣旇緝绗﹀悎", "score": 3}, {"label": "D", "text": "瀹屽叏绗﹀悎", "score": 4}]}, {"id": 5, "title": "缁忓巻鎸姌鍚庯紝鎴戣兘浠庝腑鑾峰緱鎴愰暱", "options": [{"label": "A", "text": "瀹屽叏涓嶇鍚?, "score": 1}, {"label": "B", "text": "姣旇緝涓嶇鍚?, "score": 2}, {"label": "C", "text": "姣旇緝绗﹀悎", "score": 3}, {"label": "D", "text": "瀹屽叏绗﹀悎", "score": 4}]}, {"id": 6, "title": "鎴戜細鎶婂洶闅剧湅浣滄寫鎴樿€屼笉鏄▉鑳?, "options": [{"label": "A", "text": "瀹屽叏涓嶇鍚?, "score": 1}, {"label": "B", "text": "姣旇緝涓嶇鍚?, "score": 2}, {"label": "C", "text": "姣旇緝绗﹀悎", "score": 3}, {"label": "D", "text": "瀹屽叏绗﹀悎", "score": 4}]}, {"id": 7, "title": "鎴戣兘浠庤繃鍘荤殑缁忓巻涓辈鍙栧姏閲?, "options": [{"label": "A", "text": "瀹屽叏涓嶇鍚?, "score": 1}, {"label": "B", "text": "姣旇緝涓嶇鍚?, "score": 2}, {"label": "C", "text": "姣旇緝绗﹀悎", "score": 3}, {"label": "D", "text": "瀹屽叏绗﹀悎", "score": 4}]}, {"id": 8, "title": "鎴戞嫢鏈夎嚦灏戜竴涓彲浠ヤ緷闈犵殑鏀寔鑰?, "options": [{"label": "A", "text": "瀹屽叏涓嶇鍚?, "score": 1}, {"label": "B", "text": "姣旇緝涓嶇鍚?, "score": 2}, {"label": "C", "text": "姣旇緝绗﹀悎", "score": 3}, {"label": "D", "text": "瀹屽叏绗﹀悎", "score": 4}]}, {"id": 9, "title": "闈㈠闂鏃舵垜鍊惧悜浜庡叧娉ㄨВ鍐虫柟妗?, "options": [{"label": "A", "text": "瀹屽叏涓嶇鍚?, "score": 1}, {"label": "B", "text": "姣旇緝涓嶇鍚?, "score": 2}, {"label": "C", "text": "姣旇緝绗﹀悎", "score": 3}, {"label": "D", "text": "瀹屽叏绗﹀悎", "score": 4}]}, {"id": 10, "title": "鍦ㄥ洶闅炬椂鏈燂紝鎴戠煡閬撳幓鍝噷瀵绘眰甯姪", "options": [{"label": "A", "text": "瀹屽叏涓嶇鍚?, "score": 1}, {"label": "B", "text": "姣旇緝涓嶇鍚?, "score": 2}, {"label": "C", "text": "姣旇緝绗﹀悎", "score": 3}, {"label": "D", "text": "瀹屽叏绗﹀悎", "score": 4}]}, {"id": 11, "title": "鎴戠浉淇℃墍鏈変簨鎯呯殑鍙戠敓閮芥湁鍏跺師鍥?, "options": [{"label": "A", "text": "瀹屽叏涓嶇鍚?, "score": 1}, {"label": "B", "text": "姣旇緝涓嶇鍚?, "score": 2}, {"label": "C", "text": "姣旇緝绗﹀悎", "score": 3}, {"label": "D", "text": "瀹屽叏绗﹀悎", "score": 4}]}, {"id": 12, "title": "鎴戝鑷繁澶勭悊闂鐨勮兘鍔涙劅鍒拌嚜璞?, "options": [{"label": "A", "text": "瀹屽叏涓嶇鍚?, "score": 1}, {"label": "B", "text": "姣旇緝涓嶇鍚?, "score": 2}, {"label": "C", "text": "姣旇緝绗﹀悎", "score": 3}, {"label": "D", "text": "瀹屽叏绗﹀悎", "score": 4}]}]};

var scaleKeys = {1:"sas",2:"sds",3:"stress",4:"relate",5:"emotion",6:"self_esteem",7:"sleep",8:"resilience",9:"mbti"};


var auth = require('../../utils/auth');
var scoringEngine = require('../../utils/scoring-engine');
var semesterService = require('../../utils/semester');
var resultSync = require('../../utils/result-sync');

var DRAFT_EXPIRE_MS = 24 * 60 * 60 * 1000;
var AUTO_SAVE_INTERVAL_MS = 30000;

Page({
  data: {
    consentGiven: false,
    assessmentId: 1,
    taskId: 0,
    draftKey: '',
    questions: [],
    currentIndex: 0,
    totalQuestions: 0,
    answers: {},
    selectedOption: -1,
    isFirst: true,
    isLast: false,
    progress: 0,
    shuffleOrder: null,
    multiSelected: [],
    matrixAnswers: {},
    showRestoreModal: false,
    draftInfo: null,
    draftSavedText: '',
    showDraftIndicator: false
  },

  onConsentAgree: function() {
    var time = new Date().toLocaleString();
    var records = wx.getStorageSync("consentRecords") || [];
    records.push({ type: "assessment", assessmentId: this.data.assessmentId, taskId: this.data.taskId, agreed: true, time: time, version: "1.0" });
    wx.setStorageSync("consentRecords", records);
    this.setData({ consentGiven: true });
    this.startAutoSaveTimer();
  },


  onShow: function() {
    if (!this.data.consentGiven) return;
    this.startAutoSaveTimer();
  },
  onConsentBack: function() { wx.navigateBack(); },

  onLoad: function(options) {
    if (!auth.requireRole('student')) return;
    var id = parseInt(options.id) || 1;
    var taskId = parseInt(options.taskId) || 0;
    var key = scaleKeys[id] || 'sas';
    var questions = questionSets[key] || questionSets['sas'];
    var draftKey = 'assessmentDraft_' + id + '_' + taskId;
    var draft = wx.getStorageSync(draftKey) || {};
    var hasDraft = !!(draft.answers && draft.updatedAt && (Date.now() - draft.updatedAt < DRAFT_EXPIRE_MS));
    var currentIndex = 0;
    var answers = {};

    if (hasDraft && Object.keys(draft.answers).length > 0) {
      this.setData({
        showRestoreModal: true,
        draftInfo: {
          answeredCount: Object.keys(draft.answers).length,
          totalCount: questions.length,
          savedTime: this.formatDraftTime(draft.updatedAt)
        }
      });
      currentIndex = Math.min(parseInt(draft.currentIndex) || 0, questions.length - 1);
      answers = draft.answers || {};
    }

    this.setData({
      assessmentId: id,
      taskId: taskId,
      draftKey: draftKey,
      questions: questions,
      answers: answers,
      currentIndex: currentIndex,
      selectedOption: answers[currentIndex] !== undefined ? answers[currentIndex] : -1,
      totalQuestions: questions.length,
      isFirst: currentIndex === 0,
      isLast: currentIndex === questions.length - 1,
      progress: Math.round(((currentIndex + 1) / questions.length) * 100)
    });
  },


  _initQuestionState: function(questionIndex) {
    var q = this.data.questions[questionIndex];
    if (!q || !q.type || q.type === "single") {
      this.setData({ multiSelected: [], matrixAnswers: {} });
      return;
    }
    if (q.type === "multiple") {
      var ans = this.data.answers[questionIndex];
      this.setData({ multiSelected: Array.isArray(ans) ? ans.slice() : [], matrixAnswers: {} });
    } else if (q.type === "matrix") {
      var ans = this.data.answers[questionIndex];
      this.setData({ matrixAnswers: (ans && typeof ans === "object") ? JSON.parse(JSON.stringify(ans)) : {}, multiSelected: [] });
    } else if (q.type === "boolean") {
      var ans = this.data.answers[questionIndex];
      this.setData({ selectedOption: (ans !== undefined && ans !== null) ? ans : -1, multiSelected: [], matrixAnswers: {} });
    } else {
      this.setData({ multiSelected: [], matrixAnswers: {} });
    }
  },
  restoreDraft: function() {
    wx.showToast({ title: '已恢复答题进度', icon: 'success' });
    this.setData({ showRestoreModal: false, consentGiven: true });
    this.startAutoSaveTimer();
  },

  discardDraft: function() {
    if (this.data.draftKey) wx.removeStorageSync(this.data.draftKey);
    this.setData({
      showRestoreModal: false,
      consentGiven: true,
      answers: {},
      currentIndex: 0,
      selectedOption: -1,
      isFirst: true,
      isLast: false,
      progress: 0
    });
    this.startAutoSaveTimer();
  },

  formatDraftTime: function(timestamp) {
    var diff = Math.floor((Date.now() - timestamp) / 1000);
    if (diff < 60) return '刚刚';
    if (diff < 3600) return Math.floor(diff / 60) + '分钟前';
    if (diff < 86400) return Math.floor(diff / 3600) + '小时前';
    var d = new Date(timestamp);
    return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + d.getHours() + ':' + (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
  },

  startAutoSaveTimer: function() {
    var self = this;
    this.stopAutoSaveTimer();
    this._autoSaveTimer = setInterval(function() {
      self.saveDraft(true);
    }, AUTO_SAVE_INTERVAL_MS);
  },

  stopAutoSaveTimer: function() {
    if (this._autoSaveTimer) {
      clearInterval(this._autoSaveTimer);
      this._autoSaveTimer = null;
    }
  },


  onMultiSelect: function(e) {
    var optIdx = e.currentTarget.dataset.index;
    var selected = this.data.multiSelected.slice();
    var idx = selected.indexOf(optIdx);
    var question = this.data.questions[this.data.currentIndex];
    var maxSelect = question.maxSelect || (question.options ? question.options.length : 99);
    if (idx >= 0) {
      selected.splice(idx, 1);
    } else {
      if (selected.length >= maxSelect) {
        wx.showToast({ title: "最多选择 " + maxSelect + " 项", icon: "none" });
        return;
      }
      selected.push(optIdx);
      selected.sort(function(a, b) { return a - b; });
    }
    var answers = this.data.answers;
    answers[this.data.currentIndex] = selected;
    this.setData({ multiSelected: selected, answers: answers });
    this.saveDraft();
  },

  onMatrixSelect: function(e) {
    var rowId = e.currentTarget.dataset.rowId;
    var colIdx = e.currentTarget.dataset.colIdx;
    var matrixAnswers = this.data.matrixAnswers;
    matrixAnswers = JSON.parse(JSON.stringify(matrixAnswers));
    matrixAnswers[rowId] = colIdx;
    var answers = this.data.answers;
    answers[this.data.currentIndex] = matrixAnswers;
    this.setData({ matrixAnswers: matrixAnswers, answers: answers });
    this.saveDraft();
  },

  onBooleanSelect: function(e) {
    var value = parseInt(e.currentTarget.dataset.value);
    var answers = this.data.answers;
    answers[this.data.currentIndex] = value;
    this.setData({ selectedOption: value, answers: answers });
    this.saveDraft();
  },
  onSelectOption: function(e) {
    var optIdx = e.currentTarget.dataset.index;
    var answers = this.data.answers;
    answers[this.data.currentIndex] = optIdx;
    this.setData({ selectedOption: optIdx, answers: answers });
    this.saveDraft();
  },

  saveDraft: function(isAuto) {
    if (!this.data.draftKey) return;
    var now = Date.now();
    wx.setStorageSync(this.data.draftKey, {
      answers: this.data.answers,
      currentIndex: this.data.currentIndex,
      updatedAt: now,
      assessmentId: this.data.assessmentId,
      taskId: this.data.taskId,
      answeredCount: Object.keys(this.data.answers).length,
      multiSelected: this.data.multiSelected.slice(),
      matrixAnswers: JSON.parse(JSON.stringify(this.data.matrixAnswers))
    });
    var prefix = isAuto ? '答题已自动保存 ' : '答题已保存 ';
    this.setData({ draftSavedText: prefix + this.formatTimeShort(now), showDraftIndicator: true });
    var self = this;
    if (this._draftIndicatorTimer) clearTimeout(this._draftIndicatorTimer);
    this._draftIndicatorTimer = setTimeout(function() {
      self.setData({ showDraftIndicator: false });
    }, 2000);
  },

  formatTimeShort: function(ts) {
    var d = new Date(ts);
    return (d.getHours() < 10 ? '0' : '') + d.getHours() + ':' + (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
  },

  onPrev: function() {
    if (this.data.currentIndex <= 0) return;
    var newIndex = this.data.currentIndex - 1;
    var prevAnswer = this.data.answers[newIndex];
    this.setData({
      currentIndex: newIndex,
      selectedOption: prevAnswer !== undefined ? prevAnswer : -1,
      isFirst: newIndex === 0,
      isLast: false,
      progress: Math.round(((newIndex + 1) / this.data.totalQuestions) * 100)
    });
    this.saveDraft();
  },

  onNext: function() {
    if (this.data.currentIndex >= this.data.totalQuestions - 1) return;
    var newIndex = this.data.currentIndex + 1;
    var nextAnswer = this.data.answers[newIndex];
    this.setData({
      currentIndex: newIndex,
      selectedOption: nextAnswer !== undefined ? nextAnswer : -1,
      isFirst: false,
      isLast: newIndex === this.data.totalQuestions - 1,
      progress: Math.round(((newIndex + 1) / this.data.totalQuestions) * 100)
    });
    this.saveDraft();
  },

  onHide: function() {
    this.saveDraft(true);
    this.stopAutoSaveTimer();
  },

  onUnload: function() {
    this.stopAutoSaveTimer();
  },

  onSubmit: function() {
    var that = this;
    var answers = this.data.answers;
    var total = this.data.totalQuestions;
    var notAnswered = [];
    for (var i = 0; i < total; i++) {
      if (answers[i] === undefined) notAnswered.push(i + 1);
    }
    if (notAnswered.length > 0) {
      wx.showModal({
        title: '提示',
        content: '还有第' + notAnswered.join(',') + ' 题未作答，确定提交吗？',
        success: function(res) {
          if (res.confirm) that.doSubmit();
        }
      });
    } else {
      this.doSubmit();
    }
  },

  doSubmit: function() {
    var self = this;
    this.stopAutoSaveTimer();
    var answers = this.data.answers;
    var questions = this.data.questions;
    var id = this.data.assessmentId;
    var tasks = wx.getStorageSync('assessmentTasks') || [];
    var taskId = parseInt(this.data.taskId) || 0;
    var task = tasks.find(function(item) { return item.id === taskId; }) || {};
    var assessments = wx.getStorageSync('assessments') || [];
    var assessment = assessments.find(function(item) { return item.id === id; }) || { id: id, name: '心理健康测评' };
    var rule;
    var outcome;
    try {
      rule = scoringEngine.getRule(id, task.scoringVersion);
      var complexTypes = {};
    for (var qi = 0; qi < questions.length; qi++) {
      var q = questions[qi];
      if (!q || !q.type || q.type === 'single') continue;
      var ans = answers[qi];
      if (ans === undefined || ans === null) continue;
      if (q.type === 'multiple') {
        complexTypes[qi] = { pattern: 'sum', options: q.options || [], answer: Array.isArray(ans) ? ans : [] };
      } else if (q.type === 'matrix') {
        complexTypes[qi] = { pattern: 'matrix', rows: q.rows || [], columns: q.columns || [], answer: (ans && typeof ans === 'object') ? ans : {} };
      } else if (q.type === 'boolean') {
        complexTypes[qi] = { pattern: 'binary', answer: ans, scoreTrue: q.scoreTrue, scoreFalse: q.scoreFalse };
      }
    }
    outcome = scoringEngine.scoreAssessment({ assessmentId: id, questions: questions, answers: answers, rule: rule, complexTypes: complexTypes });
    } catch (error) {
      wx.showToast({ title: error.message || '评分规则加载失败', icon: 'none' });
      return;
    }
    if (!outcome.complete) {
      wx.showToast({ title: '请完成全部题目后再提交', icon: 'none' });
      return;
    }

    var semester = task.semesterId
      ? semesterService.getSemesterSnapshot(task.semesterId)
      : semesterService.getSemesterSnapshot();
    var user = wx.getStorageSync('userInfo') || {};
    var result = scoringEngine.createResultSnapshot({
      assessment: assessment,
      task: task,
      semester: semester,
      questions: questions,
      outcome: outcome,
      rule: rule,
      studentId: user.studentId || 'demo-student'
    });
    result.submissionId = 'client:' + result.studentId + ':' + result.id;
    result.syncStatus = 'pending';
    var results = wx.getStorageSync('assessmentResults') || [];
    results.push(result);
    wx.setStorageSync('assessmentResults', results);
    resultSync.enqueueResult(result);

    var students = wx.getStorageSync('classStudents') || [];
    students = students.map(function(item) {
      if (item.studentId === result.studentId) {
        item.completion = '已完成';
        item.riskLevel = result.riskLevel;
        item.latestScore = result.stdScore;
      }
      return item;
    });
    wx.setStorageSync('classStudents', students);

    if (scoringEngine.riskSeverity(result.riskLevel) > 0) {
      var student = students.find(function(item) { return item.studentId === result.studentId; }) || {};
      var riskEvents = wx.getStorageSync('riskEvents') || [];
      riskEvents.push({
        id: result.id,
        resultId: result.id,
        studentId: result.studentId,
        studentName: student.studentName || user.nickName || '学生',
        classId: student.classId || user.classId || '',
        className: student.className || user.className || '未分班',
        level: result.riskLevel,
        source: task.title || assessment.name,
        createdAt: new Date().toLocaleString(),
        status: '待确认',
        summary: outcome.triggeredRules.length
          ? '关键题规则已触发，请由有权限人员及时人工复核。'
          : '风险标准分达到关注阈值，请结合实际情况人工复核。'
      });
      wx.setStorageSync('riskEvents', riskEvents);
    }

    if (this.data.draftKey) wx.removeStorageSync(this.data.draftKey);
    if (this.data.taskId) {
      tasks = tasks.map(function(task) { if (task.id === parseInt(self.data.taskId)) task.completed = true; return task; });
      wx.setStorageSync('assessmentTasks', tasks);
    }
    wx.redirectTo({
      url: '/pages/assessment/result?id=' + id + '&resultId=' + result.id + '&readonly=1'
    });
  }
});