// pages/assessment/detail.js
var questionSets = {"sas": [{"id": 1, "title": "我觉得比平时容易紧张和着急", "options": [{"label": "A", "text": "没有或很少时间", "score": 1}, {"label": "B", "text": "小部分时间", "score": 2}, {"label": "C", "text": "相当多时间", "score": 3}, {"label": "D", "text": "绝大部分或全部时间", "score": 4}]}, {"id": 2, "title": "我无缘无故地感到害怕", "options": [{"label": "A", "text": "没有或很少时间", "score": 1}, {"label": "B", "text": "小部分时间", "score": 2}, {"label": "C", "text": "相当多时间", "score": 3}, {"label": "D", "text": "绝大部分或全部时间", "score": 4}]}, {"id": 3, "title": "我容易心里烦乱或觉得惊恐", "options": [{"label": "A", "text": "没有或很少时间", "score": 1}, {"label": "B", "text": "小部分时间", "score": 2}, {"label": "C", "text": "相当多时间", "score": 3}, {"label": "D", "text": "绝大部分或全部时间", "score": 4}]}, {"id": 4, "title": "我觉得我可能将要发疯", "options": [{"label": "A", "text": "没有或很少时间", "score": 1}, {"label": "B", "text": "小部分时间", "score": 2}, {"label": "C", "text": "相当多时间", "score": 3}, {"label": "D", "text": "绝大部分或全部时间", "score": 4}]}, {"id": 5, "title": "我觉得一切都很好，也不会发生什么不幸", "options": [{"label": "A", "text": "绝大部分时间", "score": 4}, {"label": "B", "text": "相当多时间", "score": 3}, {"label": "C", "text": "小部分时间", "score": 2}, {"label": "D", "text": "没有或很少时间", "score": 1}]}, {"id": 6, "title": "我手脚发抖打颤", "options": [{"label": "A", "text": "没有或很少时间", "score": 1}, {"label": "B", "text": "小部分时间", "score": 2}, {"label": "C", "text": "相当多时间", "score": 3}, {"label": "D", "text": "绝大部分或全部时间", "score": 4}]}, {"id": 7, "title": "我因为头痛、颈痛和背痛而苦恼", "options": [{"label": "A", "text": "没有或很少时间", "score": 1}, {"label": "B", "text": "小部分时间", "score": 2}, {"label": "C", "text": "相当多时间", "score": 3}, {"label": "D", "text": "绝大部分或全部时间", "score": 4}]}, {"id": 8, "title": "我感觉容易衰弱和疲乏", "options": [{"label": "A", "text": "没有或很少时间", "score": 1}, {"label": "B", "text": "小部分时间", "score": 2}, {"label": "C", "text": "相当多时间", "score": 3}, {"label": "D", "text": "绝大部分或全部时间", "score": 4}]}, {"id": 9, "title": "我觉得心平气和，并且容易安静坐着", "options": [{"label": "A", "text": "绝大部分时间", "score": 4}, {"label": "B", "text": "相当多时间", "score": 3}, {"label": "C", "text": "小部分时间", "score": 2}, {"label": "D", "text": "没有或很少时间", "score": 1}]}, {"id": 10, "title": "我觉得心跳得很快", "options": [{"label": "A", "text": "没有或很少时间", "score": 1}, {"label": "B", "text": "小部分时间", "score": 2}, {"label": "C", "text": "相当多时间", "score": 3}, {"label": "D", "text": "绝大部分或全部时间", "score": 4}]}, {"id": 11, "title": "我因为一阵阵头晕而苦恼", "options": [{"label": "A", "text": "没有或很少时间", "score": 1}, {"label": "B", "text": "小部分时间", "score": 2}, {"label": "C", "text": "相当多时间", "score": 3}, {"label": "D", "text": "绝大部分或全部时间", "score": 4}]}, {"id": 12, "title": "我有晕倒发作，或觉得要晕倒似的", "options": [{"label": "A", "text": "没有或很少时间", "score": 1}, {"label": "B", "text": "小部分时间", "score": 2}, {"label": "C", "text": "相当多时间", "score": 3}, {"label": "D", "text": "绝大部分或全部时间", "score": 4}]}, {"id": 13, "title": "我吸气呼气都感到很容易", "options": [{"label": "A", "text": "绝大部分时间", "score": 4}, {"label": "B", "text": "相当多时间", "score": 3}, {"label": "C", "text": "小部分时间", "score": 2}, {"label": "D", "text": "没有或很少时间", "score": 1}]}, {"id": 14, "title": "我的手脚麻木和刺痛", "options": [{"label": "A", "text": "没有或很少时间", "score": 1}, {"label": "B", "text": "小部分时间", "score": 2}, {"label": "C", "text": "相当多时间", "score": 3}, {"label": "D", "text": "绝大部分或全部时间", "score": 4}]}, {"id": 15, "title": "我因为胃痛和消化不良而苦恼", "options": [{"label": "A", "text": "没有或很少时间", "score": 1}, {"label": "B", "text": "小部分时间", "score": 2}, {"label": "C", "text": "相当多时间", "score": 3}, {"label": "D", "text": "绝大部分或全部时间", "score": 4}]}, {"id": 16, "title": "我常常要小便", "options": [{"label": "A", "text": "没有或很少时间", "score": 1}, {"label": "B", "text": "小部分时间", "score": 2}, {"label": "C", "text": "相当多时间", "score": 3}, {"label": "D", "text": "绝大部分或全部时间", "score": 4}]}, {"id": 17, "title": "我的手脚常常是干燥温暖的", "options": [{"label": "A", "text": "绝大部分时间", "score": 4}, {"label": "B", "text": "相当多时间", "score": 3}, {"label": "C", "text": "小部分时间", "score": 2}, {"label": "D", "text": "没有或很少时间", "score": 1}]}, {"id": 18, "title": "我脸红发热", "options": [{"label": "A", "text": "没有或很少时间", "score": 1}, {"label": "B", "text": "小部分时间", "score": 2}, {"label": "C", "text": "相当多时间", "score": 3}, {"label": "D", "text": "绝大部分或全部时间", "score": 4}]}, {"id": 19, "title": "我容易入睡并且一夜睡得很好", "options": [{"label": "A", "text": "绝大部分时间", "score": 4}, {"label": "B", "text": "相当多时间", "score": 3}, {"label": "C", "text": "小部分时间", "score": 2}, {"label": "D", "text": "没有或很少时间", "score": 1}]}, {"id": 20, "title": "我做噩梦", "options": [{"label": "A", "text": "没有或很少时间", "score": 1}, {"label": "B", "text": "小部分时间", "score": 2}, {"label": "C", "text": "相当多时间", "score": 3}, {"label": "D", "text": "绝大部分或全部时间", "score": 4}]}], "sds": [{"id": 1, "title": "我觉得闷闷不乐，情绪低沉", "options": [{"label": "A", "text": "没有或很少时间", "score": 1}, {"label": "B", "text": "小部分时间", "score": 2}, {"label": "C", "text": "相当多时间", "score": 3}, {"label": "D", "text": "绝大部分或全部时间", "score": 4}]}, {"id": 2, "title": "我觉得一天之中早晨最好", "options": [{"label": "A", "text": "绝大部分时间", "score": 4}, {"label": "B", "text": "相当多时间", "score": 3}, {"label": "C", "text": "小部分时间", "score": 2}, {"label": "D", "text": "没有或很少时间", "score": 1}]}, {"id": 3, "title": "我一阵阵哭出来或觉得想哭", "options": [{"label": "A", "text": "没有或很少时间", "score": 1}, {"label": "B", "text": "小部分时间", "score": 2}, {"label": "C", "text": "相当多时间", "score": 3}, {"label": "D", "text": "绝大部分或全部时间", "score": 4}]}, {"id": 4, "title": "我晚上睡眠不好", "options": [{"label": "A", "text": "没有或很少时间", "score": 1}, {"label": "B", "text": "小部分时间", "score": 2}, {"label": "C", "text": "相当多时间", "score": 3}, {"label": "D", "text": "绝大部分或全部时间", "score": 4}]}, {"id": 5, "title": "我吃得跟平常一样多", "options": [{"label": "A", "text": "绝大部分时间", "score": 4}, {"label": "B", "text": "相当多时间", "score": 3}, {"label": "C", "text": "小部分时间", "score": 2}, {"label": "D", "text": "没有或很少时间", "score": 1}]}, {"id": 6, "title": "我与异性密切接触时和以往一样感到愉快", "options": [{"label": "A", "text": "绝大部分时间", "score": 4}, {"label": "B", "text": "相当多时间", "score": 3}, {"label": "C", "text": "小部分时间", "score": 2}, {"label": "D", "text": "没有或很少时间", "score": 1}]}, {"id": 7, "title": "我发觉我的体重在下降", "options": [{"label": "A", "text": "没有或很少时间", "score": 1}, {"label": "B", "text": "小部分时间", "score": 2}, {"label": "C", "text": "相当多时间", "score": 3}, {"label": "D", "text": "绝大部分或全部时间", "score": 4}]}, {"id": 8, "title": "我有便秘的苦恼", "options": [{"label": "A", "text": "没有或很少时间", "score": 1}, {"label": "B", "text": "小部分时间", "score": 2}, {"label": "C", "text": "相当多时间", "score": 3}, {"label": "D", "text": "绝大部分或全部时间", "score": 4}]}, {"id": 9, "title": "我心跳比平时快", "options": [{"label": "A", "text": "没有或很少时间", "score": 1}, {"label": "B", "text": "小部分时间", "score": 2}, {"label": "C", "text": "相当多时间", "score": 3}, {"label": "D", "text": "绝大部分或全部时间", "score": 4}]}, {"id": 10, "title": "我无缘无故地感到疲乏", "options": [{"label": "A", "text": "没有或很少时间", "score": 1}, {"label": "B", "text": "小部分时间", "score": 2}, {"label": "C", "text": "相当多时间", "score": 3}, {"label": "D", "text": "绝大部分或全部时间", "score": 4}]}, {"id": 11, "title": "我的头脑跟平常一样清楚", "options": [{"label": "A", "text": "绝大部分时间", "score": 4}, {"label": "B", "text": "相当多时间", "score": 3}, {"label": "C", "text": "小部分时间", "score": 2}, {"label": "D", "text": "没有或很少时间", "score": 1}]}, {"id": 12, "title": "我觉得经常做的事情并没有困难", "options": [{"label": "A", "text": "绝大部分时间", "score": 4}, {"label": "B", "text": "相当多时间", "score": 3}, {"label": "C", "text": "小部分时间", "score": 2}, {"label": "D", "text": "没有或很少时间", "score": 1}]}, {"id": 13, "title": "我觉得不安而平静不下来", "options": [{"label": "A", "text": "没有或很少时间", "score": 1}, {"label": "B", "text": "小部分时间", "score": 2}, {"label": "C", "text": "相当多时间", "score": 3}, {"label": "D", "text": "绝大部分或全部时间", "score": 4}]}, {"id": 14, "title": "我对将来抱有希望", "options": [{"label": "A", "text": "绝大部分时间", "score": 4}, {"label": "B", "text": "相当多时间", "score": 3}, {"label": "C", "text": "小部分时间", "score": 2}, {"label": "D", "text": "没有或很少时间", "score": 1}]}, {"id": 15, "title": "我比平常容易生气激动", "options": [{"label": "A", "text": "没有或很少时间", "score": 1}, {"label": "B", "text": "小部分时间", "score": 2}, {"label": "C", "text": "相当多时间", "score": 3}, {"label": "D", "text": "绝大部分或全部时间", "score": 4}]}, {"id": 16, "title": "我觉得作出决定是容易的", "options": [{"label": "A", "text": "绝大部分时间", "score": 4}, {"label": "B", "text": "相当多时间", "score": 3}, {"label": "C", "text": "小部分时间", "score": 2}, {"label": "D", "text": "没有或很少时间", "score": 1}]}, {"id": 17, "title": "我觉得自己是个有用的人，有人需要我", "options": [{"label": "A", "text": "绝大部分时间", "score": 4}, {"label": "B", "text": "相当多时间", "score": 3}, {"label": "C", "text": "小部分时间", "score": 2}, {"label": "D", "text": "没有或很少时间", "score": 1}]}, {"id": 18, "title": "我的生活过得很有意思", "options": [{"label": "A", "text": "绝大部分时间", "score": 4}, {"label": "B", "text": "相当多时间", "score": 3}, {"label": "C", "text": "小部分时间", "score": 2}, {"label": "D", "text": "没有或很少时间", "score": 1}]}, {"id": 19, "title": "我认为如果我死了别人会生活得好些", "options": [{"label": "A", "text": "没有或很少时间", "score": 1}, {"label": "B", "text": "小部分时间", "score": 2}, {"label": "C", "text": "相当多时间", "score": 3}, {"label": "D", "text": "绝大部分或全部时间", "score": 4}]}, {"id": 20, "title": "平常感兴趣的事我仍然照样感兴趣", "options": [{"label": "A", "text": "绝大部分时间", "score": 4}, {"label": "B", "text": "相当多时间", "score": 3}, {"label": "C", "text": "小部分时间", "score": 2}, {"label": "D", "text": "没有或很少时间", "score": 1}]}], "stress": [{"id": 1, "title": "我因为课程难度过大而感到压力", "options": [{"label": "A", "text": "完全不符合", "score": 1}, {"label": "B", "text": "比较不符合", "score": 2}, {"label": "C", "text": "比较符合", "score": 3}, {"label": "D", "text": "完全符合", "score": 4}]}, {"id": 2, "title": "我对考试结果感到过度担忧", "options": [{"label": "A", "text": "完全不符合", "score": 1}, {"label": "B", "text": "比较不符合", "score": 2}, {"label": "C", "text": "比较符合", "score": 3}, {"label": "D", "text": "完全符合", "score": 4}]}, {"id": 3, "title": "我难以集中注意力完成学业任务", "options": [{"label": "A", "text": "完全不符合", "score": 1}, {"label": "B", "text": "比较不符合", "score": 2}, {"label": "C", "text": "比较符合", "score": 3}, {"label": "D", "text": "完全符合", "score": 4}]}, {"id": 4, "title": "我因为作业/论文截止日期而感到压力很大", "options": [{"label": "A", "text": "完全不符合", "score": 1}, {"label": "B", "text": "比较不符合", "score": 2}, {"label": "C", "text": "比较符合", "score": 3}, {"label": "D", "text": "完全符合", "score": 4}]}, {"id": 5, "title": "我觉得自己的学习效率不如同学", "options": [{"label": "A", "text": "完全不符合", "score": 1}, {"label": "B", "text": "比较不符合", "score": 2}, {"label": "C", "text": "比较符合", "score": 3}, {"label": "D", "text": "完全符合", "score": 4}]}, {"id": 6, "title": "为了应对学业，我经常熬夜", "options": [{"label": "A", "text": "完全不符合", "score": 1}, {"label": "B", "text": "比较不符合", "score": 2}, {"label": "C", "text": "比较符合", "score": 3}, {"label": "D", "text": "完全符合", "score": 4}]}, {"id": 7, "title": "我对自己的专业方向感到迷茫", "options": [{"label": "A", "text": "完全不符合", "score": 1}, {"label": "B", "text": "比较不符合", "score": 2}, {"label": "C", "text": "比较符合", "score": 3}, {"label": "D", "text": "完全符合", "score": 4}]}, {"id": 8, "title": "家长的期望给我带来压力", "options": [{"label": "A", "text": "完全不符合", "score": 1}, {"label": "B", "text": "比较不符合", "score": 2}, {"label": "C", "text": "比较符合", "score": 3}, {"label": "D", "text": "完全符合", "score": 4}]}, {"id": 9, "title": "我因为学习放弃了很多娱乐活动", "options": [{"label": "A", "text": "完全不符合", "score": 1}, {"label": "B", "text": "比较不符合", "score": 2}, {"label": "C", "text": "比较符合", "score": 3}, {"label": "D", "text": "完全符合", "score": 4}]}, {"id": 10, "title": "想到学业我就感到心跳加速或不安", "options": [{"label": "A", "text": "完全不符合", "score": 1}, {"label": "B", "text": "比较不符合", "score": 2}, {"label": "C", "text": "比较符合", "score": 3}, {"label": "D", "text": "完全符合", "score": 4}]}, {"id": 11, "title": "我对学习成绩感到满意", "options": [{"label": "A", "text": "完全符合", "score": 4}, {"label": "B", "text": "比较符合", "score": 3}, {"label": "C", "text": "比较不符合", "score": 2}, {"label": "D", "text": "完全不符合", "score": 1}]}, {"id": 12, "title": "我能合理安排学习和休息时间", "options": [{"label": "A", "text": "完全符合", "score": 4}, {"label": "B", "text": "比较符合", "score": 3}, {"label": "C", "text": "比较不符合", "score": 2}, {"label": "D", "text": "完全不符合", "score": 1}]}, {"id": 13, "title": "遇到学业困难时我会主动寻求帮助", "options": [{"label": "A", "text": "完全符合", "score": 4}, {"label": "B", "text": "比较符合", "score": 3}, {"label": "C", "text": "比较不符合", "score": 2}, {"label": "D", "text": "完全不符合", "score": 1}]}, {"id": 14, "title": "我因为学业压力影响了睡眠质量", "options": [{"label": "A", "text": "完全不符合", "score": 1}, {"label": "B", "text": "比较不符合", "score": 2}, {"label": "C", "text": "比较符合", "score": 3}, {"label": "D", "text": "完全符合", "score": 4}]}, {"id": 15, "title": "学业压力让我感到身心俱疲", "options": [{"label": "A", "text": "完全不符合", "score": 1}, {"label": "B", "text": "比较不符合", "score": 2}, {"label": "C", "text": "比较符合", "score": 3}, {"label": "D", "text": "完全符合", "score": 4}]}], "relate": [{"id": 1, "title": "在社交场合中，我感到紧张和不自在", "options": [{"label": "A", "text": "完全不符合", "score": 1}, {"label": "B", "text": "比较不符合", "score": 2}, {"label": "C", "text": "比较符合", "score": 3}, {"label": "D", "text": "完全符合", "score": 4}]}, {"id": 2, "title": "我很难主动与陌生人交谈", "options": [{"label": "A", "text": "完全不符合", "score": 1}, {"label": "B", "text": "比较不符合", "score": 2}, {"label": "C", "text": "比较符合", "score": 3}, {"label": "D", "text": "完全符合", "score": 4}]}, {"id": 3, "title": "我担心别人对我不满意", "options": [{"label": "A", "text": "完全不符合", "score": 1}, {"label": "B", "text": "比较不符合", "score": 2}, {"label": "C", "text": "比较符合", "score": 3}, {"label": "D", "text": "完全符合", "score": 4}]}, {"id": 4, "title": "我认为自己容易被他人误解", "options": [{"label": "A", "text": "完全不符合", "score": 1}, {"label": "B", "text": "比较不符合", "score": 2}, {"label": "C", "text": "比较符合", "score": 3}, {"label": "D", "text": "完全符合", "score": 4}]}, {"id": 5, "title": "与室友/同学相处时，我经常感到困扰", "options": [{"label": "A", "text": "完全不符合", "score": 1}, {"label": "B", "text": "比较不符合", "score": 2}, {"label": "C", "text": "比较符合", "score": 3}, {"label": "D", "text": "完全符合", "score": 4}]}, {"id": 6, "title": "我很难拒绝别人的请求", "options": [{"label": "A", "text": "完全不符合", "score": 1}, {"label": "B", "text": "比较不符合", "score": 2}, {"label": "C", "text": "比较符合", "score": 3}, {"label": "D", "text": "完全符合", "score": 4}]}, {"id": 7, "title": "我觉得自己有几个真正理解我的朋友", "options": [{"label": "A", "text": "完全符合", "score": 4}, {"label": "B", "text": "比较符合", "score": 3}, {"label": "C", "text": "比较不符合", "score": 2}, {"label": "D", "text": "完全不符合", "score": 1}]}, {"id": 8, "title": "我在团队中能够自如地表达观点", "options": [{"label": "A", "text": "完全符合", "score": 4}, {"label": "B", "text": "比较符合", "score": 3}, {"label": "C", "text": "比较不符合", "score": 2}, {"label": "D", "text": "完全不符合", "score": 1}]}, {"id": 9, "title": "人际冲突后我能主动修复关系", "options": [{"label": "A", "text": "完全符合", "score": 4}, {"label": "B", "text": "比较符合", "score": 3}, {"label": "C", "text": "比较不符合", "score": 2}, {"label": "D", "text": "完全不符合", "score": 1}]}, {"id": 10, "title": "我经常感到孤独，即使周围有很多人", "options": [{"label": "A", "text": "完全不符合", "score": 1}, {"label": "B", "text": "比较不符合", "score": 2}, {"label": "C", "text": "比较符合", "score": 3}, {"label": "D", "text": "完全符合", "score": 4}]}, {"id": 11, "title": "我害怕在公开场合被批评或评价", "options": [{"label": "A", "text": "完全不符合", "score": 1}, {"label": "B", "text": "比较不符合", "score": 2}, {"label": "C", "text": "比较符合", "score": 3}, {"label": "D", "text": "完全符合", "score": 4}]}, {"id": 12, "title": "与人交往时我过分在意自己的言行", "options": [{"label": "A", "text": "完全不符合", "score": 1}, {"label": "B", "text": "比较不符合", "score": 2}, {"label": "C", "text": "比较符合", "score": 3}, {"label": "D", "text": "完全符合", "score": 4}]}, {"id": 13, "title": "我享受与朋友一起度过的时光", "options": [{"label": "A", "text": "完全符合", "score": 4}, {"label": "B", "text": "比较符合", "score": 3}, {"label": "C", "text": "比较不符合", "score": 2}, {"label": "D", "text": "完全不符合", "score": 1}]}, {"id": 14, "title": "我经常主动联系家人或老朋友", "options": [{"label": "A", "text": "完全符合", "score": 4}, {"label": "B", "text": "比较符合", "score": 3}, {"label": "C", "text": "比较不符合", "score": 2}, {"label": "D", "text": "完全不符合", "score": 1}]}, {"id": 15, "title": "人际关系问题影响了我的学习和生活", "options": [{"label": "A", "text": "完全不符合", "score": 1}, {"label": "B", "text": "比较不符合", "score": 2}, {"label": "C", "text": "比较符合", "score": 3}, {"label": "D", "text": "完全符合", "score": 4}]}], "emotion": [{"id": 1, "title": "我能清楚地识别自己当前的情绪状态", "options": [{"label": "A", "text": "完全不符合", "score": 1}, {"label": "B", "text": "比较不符合", "score": 2}, {"label": "C", "text": "比较符合", "score": 3}, {"label": "D", "text": "完全符合", "score": 4}]}, {"id": 2, "title": "当情绪低落时我知道原因是什么", "options": [{"label": "A", "text": "完全不符合", "score": 1}, {"label": "B", "text": "比较不符合", "score": 2}, {"label": "C", "text": "比较符合", "score": 3}, {"label": "D", "text": "完全符合", "score": 4}]}, {"id": 3, "title": "愤怒时我能够控制自己不做冲动的行为", "options": [{"label": "A", "text": "完全不符合", "score": 1}, {"label": "B", "text": "比较不符合", "score": 2}, {"label": "C", "text": "比较符合", "score": 3}, {"label": "D", "text": "完全符合", "score": 4}]}, {"id": 4, "title": "遇到挫折我能很快调整心态", "options": [{"label": "A", "text": "完全不符合", "score": 1}, {"label": "B", "text": "比较不符合", "score": 2}, {"label": "C", "text": "比较符合", "score": 3}, {"label": "D", "text": "完全符合", "score": 4}]}, {"id": 5, "title": "我能用健康的方式（如运动、倾诉）排解压力", "options": [{"label": "A", "text": "完全不符合", "score": 1}, {"label": "B", "text": "比较不符合", "score": 2}, {"label": "C", "text": "比较符合", "score": 3}, {"label": "D", "text": "完全符合", "score": 4}]}, {"id": 6, "title": "负面情绪来临时，我会被它长时间困扰", "options": [{"label": "A", "text": "完全符合", "score": 4}, {"label": "B", "text": "比较符合", "score": 3}, {"label": "C", "text": "比较不符合", "score": 2}, {"label": "D", "text": "完全不符合", "score": 1}]}, {"id": 7, "title": "我会因为他人的情绪而过度影响自己", "options": [{"label": "A", "text": "完全符合", "score": 4}, {"label": "B", "text": "比较符合", "score": 3}, {"label": "C", "text": "比较不符合", "score": 2}, {"label": "D", "text": "完全不符合", "score": 1}]}, {"id": 8, "title": "我经常练习正念或冥想", "options": [{"label": "A", "text": "完全不符合", "score": 1}, {"label": "B", "text": "比较不符合", "score": 2}, {"label": "C", "text": "比较符合", "score": 3}, {"label": "D", "text": "完全符合", "score": 4}]}, {"id": 9, "title": "我能接纳自己的负面情绪而不感到自责", "options": [{"label": "A", "text": "完全不符合", "score": 1}, {"label": "B", "text": "比较不符合", "score": 2}, {"label": "C", "text": "比较符合", "score": 3}, {"label": "D", "text": "完全符合", "score": 4}]}, {"id": 10, "title": "情绪波动不会显著影响我的学习效率", "options": [{"label": "A", "text": "完全不符合", "score": 1}, {"label": "B", "text": "比较不符合", "score": 2}, {"label": "C", "text": "比较符合", "score": 3}, {"label": "D", "text": "完全符合", "score": 4}]}, {"id": 11, "title": "当朋友情绪不好时，我能给予有效支持", "options": [{"label": "A", "text": "完全不符合", "score": 1}, {"label": "B", "text": "比较不符合", "score": 2}, {"label": "C", "text": "比较符合", "score": 3}, {"label": "D", "text": "完全符合", "score": 4}]}, {"id": 12, "title": "我相信自己的情绪管理能力在不断提升", "options": [{"label": "A", "text": "完全不符合", "score": 1}, {"label": "B", "text": "比较不符合", "score": 2}, {"label": "C", "text": "比较符合", "score": 3}, {"label": "D", "text": "完全符合", "score": 4}]}], "self_esteem": [{"id": 1, "title": "我感到我是一个有价值的人，至少与其他人在同一水平上", "options": [{"label": "A", "text": "非常不同意", "score": 1}, {"label": "B", "text": "不同意", "score": 2}, {"label": "C", "text": "同意", "score": 3}, {"label": "D", "text": "非常同意", "score": 4}]}, {"id": 2, "title": "我感到我有许多好的品质", "options": [{"label": "A", "text": "非常不同意", "score": 1}, {"label": "B", "text": "不同意", "score": 2}, {"label": "C", "text": "同意", "score": 3}, {"label": "D", "text": "非常同意", "score": 4}]}, {"id": 3, "title": "归根结底，我倾向于觉得自己是一个失败者", "options": [{"label": "A", "text": "非常同意", "score": 4}, {"label": "B", "text": "同意", "score": 3}, {"label": "C", "text": "不同意", "score": 2}, {"label": "D", "text": "非常不同意", "score": 1}]}, {"id": 4, "title": "我能像大多数人一样把事情做好", "options": [{"label": "A", "text": "非常不同意", "score": 1}, {"label": "B", "text": "不同意", "score": 2}, {"label": "C", "text": "同意", "score": 3}, {"label": "D", "text": "非常同意", "score": 4}]}, {"id": 5, "title": "我感到自己值得自豪的地方不多", "options": [{"label": "A", "text": "非常同意", "score": 4}, {"label": "B", "text": "同意", "score": 3}, {"label": "C", "text": "不同意", "score": 2}, {"label": "D", "text": "非常不同意", "score": 1}]}, {"id": 6, "title": "我对自己持肯定态度", "options": [{"label": "A", "text": "非常不同意", "score": 1}, {"label": "B", "text": "不同意", "score": 2}, {"label": "C", "text": "同意", "score": 3}, {"label": "D", "text": "非常同意", "score": 4}]}, {"id": 7, "title": "总的来说，我对自己是满意的", "options": [{"label": "A", "text": "非常不同意", "score": 1}, {"label": "B", "text": "不同意", "score": 2}, {"label": "C", "text": "同意", "score": 3}, {"label": "D", "text": "非常同意", "score": 4}]}, {"id": 8, "title": "我要是能更看得起自己就好了", "options": [{"label": "A", "text": "非常同意", "score": 4}, {"label": "B", "text": "同意", "score": 3}, {"label": "C", "text": "不同意", "score": 2}, {"label": "D", "text": "非常不同意", "score": 1}]}, {"id": 9, "title": "我确实时常感到自己毫无用处", "options": [{"label": "A", "text": "非常同意", "score": 4}, {"label": "B", "text": "同意", "score": 3}, {"label": "C", "text": "不同意", "score": 2}, {"label": "D", "text": "非常不同意", "score": 1}]}, {"id": 10, "title": "我时常认为自己一无是处", "options": [{"label": "A", "text": "非常同意", "score": 4}, {"label": "B", "text": "同意", "score": 3}, {"label": "C", "text": "不同意", "score": 2}, {"label": "D", "text": "非常不同意", "score": 1}]}], "sleep": [{"id": 1, "title": "近一月，你通常晚上几点上床睡觉？", "options": [{"label": "A", "text": "22:00之前", "score": 1}, {"label": "B", "text": "22:00-23:00", "score": 2}, {"label": "C", "text": "23:00-0:00", "score": 3}, {"label": "D", "text": "0:00之后", "score": 4}]}, {"id": 2, "title": "近一月，你从上床到入睡通常需要多长时间", "options": [{"label": "A", "text": "小于15分钟", "score": 1}, {"label": "B", "text": "15-30分钟", "score": 2}, {"label": "C", "text": "30-60分钟", "score": 3}, {"label": "D", "text": "超过60分钟", "score": 4}]}, {"id": 3, "title": "近一月，你通常早上几点起床", "options": [{"label": "A", "text": "6:00之前", "score": 1}, {"label": "B", "text": "6:00-7:00", "score": 2}, {"label": "C", "text": "7:00-8:00", "score": 3}, {"label": "D", "text": "8:00之后", "score": 4}]}, {"id": 4, "title": "近一月，你每晚实际睡眠时间约为", "options": [{"label": "A", "text": "大于7小时", "score": 1}, {"label": "B", "text": "6-7小时", "score": 2}, {"label": "C", "text": "5-6小时", "score": 3}, {"label": "D", "text": "少于5小时", "score": 4}]}, {"id": 5, "title": "近一月，你是否因为「入睡困难」而影响睡眠", "options": [{"label": "A", "text": "无", "score": 1}, {"label": "B", "text": "每周少于1次", "score": 2}, {"label": "C", "text": "每周1-2次", "score": 3}, {"label": "D", "text": "每周3次以上", "score": 4}]}, {"id": 6, "title": "近一月，你是否因为「夜间易醒或早醒」而影响睡眠", "options": [{"label": "A", "text": "无", "score": 1}, {"label": "B", "text": "每周少于1次", "score": 2}, {"label": "C", "text": "每周1-2次", "score": 3}, {"label": "D", "text": "每周3次以上", "score": 4}]}, {"id": 7, "title": "近一月，你是否因为「夜间去厕所」而影响睡眠", "options": [{"label": "A", "text": "无", "score": 1}, {"label": "B", "text": "每周少于1次", "score": 2}, {"label": "C", "text": "每周1-2次", "score": 3}, {"label": "D", "text": "每周3次以上", "score": 4}]}, {"id": 8, "title": "近一月，你是否因为「做噩梦」而影响睡眠", "options": [{"label": "A", "text": "无", "score": 1}, {"label": "B", "text": "每周少于1次", "score": 2}, {"label": "C", "text": "每周1-2次", "score": 3}, {"label": "D", "text": "每周3次以上", "score": 4}]}, {"id": 9, "title": "近一月，你是否需要使用药物助眠", "options": [{"label": "A", "text": "无", "score": 1}, {"label": "B", "text": "每周少于1次", "score": 2}, {"label": "C", "text": "每周1-2次", "score": 3}, {"label": "D", "text": "每周3次以上", "score": 4}]}, {"id": 10, "title": "近一月，你如何评价自己的整体睡眠质量", "options": [{"label": "A", "text": "很好", "score": 1}, {"label": "B", "text": "较好", "score": 2}, {"label": "C", "text": "较差", "score": 3}, {"label": "D", "text": "很差", "score": 4}]}], "resilience": [{"id": 1, "title": "我能够适应生活中的变化", "options": [{"label": "A", "text": "完全不符合", "score": 1}, {"label": "B", "text": "比较不符合", "score": 2}, {"label": "C", "text": "比较符合", "score": 3}, {"label": "D", "text": "完全符合", "score": 4}]}, {"id": 2, "title": "面对压力事件，我能保持冷静和专注", "options": [{"label": "A", "text": "完全不符合", "score": 1}, {"label": "B", "text": "比较不符合", "score": 2}, {"label": "C", "text": "比较符合", "score": 3}, {"label": "D", "text": "完全符合", "score": 4}]}, {"id": 3, "title": "我相信自己有能力克服困难", "options": [{"label": "A", "text": "完全不符合", "score": 1}, {"label": "B", "text": "比较不符合", "score": 2}, {"label": "C", "text": "比较符合", "score": 3}, {"label": "D", "text": "完全符合", "score": 4}]}, {"id": 4, "title": "即使事情看起来无望，我也不会轻易放弃", "options": [{"label": "A", "text": "完全不符合", "score": 1}, {"label": "B", "text": "比较不符合", "score": 2}, {"label": "C", "text": "比较符合", "score": 3}, {"label": "D", "text": "完全符合", "score": 4}]}, {"id": 5, "title": "经历挫折后，我能从中获得成长", "options": [{"label": "A", "text": "完全不符合", "score": 1}, {"label": "B", "text": "比较不符合", "score": 2}, {"label": "C", "text": "比较符合", "score": 3}, {"label": "D", "text": "完全符合", "score": 4}]}, {"id": 6, "title": "我会把困难看作挑战而不是威胁", "options": [{"label": "A", "text": "完全不符合", "score": 1}, {"label": "B", "text": "比较不符合", "score": 2}, {"label": "C", "text": "比较符合", "score": 3}, {"label": "D", "text": "完全符合", "score": 4}]}, {"id": 7, "title": "我能从过去的经历中汲取力量", "options": [{"label": "A", "text": "完全不符合", "score": 1}, {"label": "B", "text": "比较不符合", "score": 2}, {"label": "C", "text": "比较符合", "score": 3}, {"label": "D", "text": "完全符合", "score": 4}]}, {"id": 8, "title": "我拥有至少一个可以依靠的支持者", "options": [{"label": "A", "text": "完全不符合", "score": 1}, {"label": "B", "text": "比较不符合", "score": 2}, {"label": "C", "text": "比较符合", "score": 3}, {"label": "D", "text": "完全符合", "score": 4}]}, {"id": 9, "title": "面对问题时我倾向于关注解决方案", "options": [{"label": "A", "text": "完全不符合", "score": 1}, {"label": "B", "text": "比较不符合", "score": 2}, {"label": "C", "text": "比较符合", "score": 3}, {"label": "D", "text": "完全符合", "score": 4}]}, {"id": 10, "title": "在困难时期，我知道去哪里寻求帮助", "options": [{"label": "A", "text": "完全不符合", "score": 1}, {"label": "B", "text": "比较不符合", "score": 2}, {"label": "C", "text": "比较符合", "score": 3}, {"label": "D", "text": "完全符合", "score": 4}]}, {"id": 11, "title": "我相信所有事情的发生都有其原因", "options": [{"label": "A", "text": "完全不符合", "score": 1}, {"label": "B", "text": "比较不符合", "score": 2}, {"label": "C", "text": "比较符合", "score": 3}, {"label": "D", "text": "完全符合", "score": 4}]}, {"id": 12, "title": "我对自己处理问题的能力感到自豪", "options": [{"label": "A", "text": "完全不符合", "score": 1}, {"label": "B", "text": "比较不符合", "score": 2}, {"label": "C", "text": "比较符合", "score": 3}, {"label": "D", "text": "完全符合", "score": 4}]}]};

var scaleKeys = {1:"sas",2:"sds",3:"stress",4:"relate",5:"emotion",6:"self_esteem",7:"sleep",8:"resilience",9:"mbti"};
var auth = require('../../utils/auth');
var scoringEngine = require('../../utils/scoring-engine');
var semesterService = require('../../utils/semester');
var resultSync = require('../../utils/result-sync');

Page({
  data: {consentGiven: false,
    assessmentId: 1,
    taskId: 0,
    draftKey: "",
    questions: [],
    currentIndex: 0,
    totalQuestions: 0,
    answers: {},
    selectedOption: -1,
    isFirst: true,
    isLast: false,
    progress: 0
  },

  onConsentAgree: function() {
    var time = new Date().toLocaleString();
    var records = wx.getStorageSync("consentRecords") || [];
    records.push({ type: "assessment", assessmentId: this.data.assessmentId, taskId: this.data.taskId, agreed: true, time: time, version: "1.0" });
    wx.setStorageSync("consentRecords", records);
    this.setData({ consentGiven: true });
  },onConsentBack: function() { wx.navigateBack(); },onLoad: function(options) {
    if (!auth.requireRole('student')) return;
    var id = parseInt(options.id) || 1;
    var taskId = parseInt(options.taskId) || 0;
    var key = scaleKeys[id] || "sas";
    var questions = questionSets[key] || questionSets["sas"];
    var draftKey = "assessmentDraft_" + id + "_" + taskId;
    var draft = wx.getStorageSync(draftKey) || {};
    var currentIndex = Math.min(parseInt(draft.currentIndex) || 0, questions.length - 1);
    var answers = draft.answers || {};
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

  onSelectOption: function(e) {
    var optIdx = e.currentTarget.dataset.index;
    var answers = this.data.answers;
    answers[this.data.currentIndex] = optIdx;
    this.setData({ selectedOption: optIdx, answers: answers });
    this.saveDraft();
  },

  saveDraft: function() {
    if (!this.data.draftKey) return;
    wx.setStorageSync(this.data.draftKey, { answers: this.data.answers, currentIndex: this.data.currentIndex, updatedAt: Date.now() });
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
        title: "提示",
        content: "还有第 " + notAnswered.join(",") + " 题未作答，确定提交吗？",
        success: function(res) {
          if (res.confirm) that.doSubmit();
        }
      });
    } else {
      this.doSubmit();
    }
  },

  doSubmit: function() {
    var answers = this.data.answers;
    var questions = this.data.questions;
    var id = this.data.assessmentId;
    var tasks = wx.getStorageSync("assessmentTasks") || [];
    var taskId = parseInt(this.data.taskId) || 0;
    var task = tasks.find(function(item) { return item.id === taskId; }) || {};
    var assessments = wx.getStorageSync("assessments") || [];
    var assessment = assessments.find(function(item) { return item.id === id; }) || { id: id, name: "心理健康测评" };
    var rule;
    var outcome;
    try {
      rule = scoringEngine.getRule(id, task.scoringVersion);
      outcome = scoringEngine.scoreAssessment({ assessmentId: id, questions: questions, answers: answers, rule: rule });
    } catch (error) {
      wx.showToast({ title: error.message || "评分规则加载失败", icon: "none" });
      return;
    }
    if (!outcome.complete) {
      wx.showToast({ title: "请完成全部题目后再提交", icon: "none" });
      return;
    }

    var semester = task.semesterId
      ? semesterService.getSemesterSnapshot(task.semesterId)
      : semesterService.getSemesterSnapshot();
    var user = wx.getStorageSync("userInfo") || {};
    var result = scoringEngine.createResultSnapshot({
      assessment: assessment,
      task: task,
      semester: semester,
      questions: questions,
      outcome: outcome,
      rule: rule,
      studentId: user.studentId || "demo-student"
    });
    result.submissionId = "client:" + result.studentId + ":" + result.id;
    result.syncStatus = "pending";
    var results = wx.getStorageSync("assessmentResults") || [];
    results.push(result);
    wx.setStorageSync("assessmentResults", results);
    resultSync.enqueueResult(result);

    var students = wx.getStorageSync("classStudents") || [];
    students = students.map(function(item) {
      if (item.studentId === result.studentId) {
        item.completion = "已完成";
        item.riskLevel = result.riskLevel;
        item.latestScore = result.stdScore;
      }
      return item;
    });
    wx.setStorageSync("classStudents", students);

    if (scoringEngine.riskSeverity(result.riskLevel) > 0) {
      var student = students.find(function(item) { return item.studentId === result.studentId; }) || {};
      var riskEvents = wx.getStorageSync("riskEvents") || [];
      riskEvents.push({
        id: result.id,
        resultId: result.id,
        studentId: result.studentId,
        studentName: student.studentName || user.nickName || "学生",
        classId: student.classId || user.classId || "",
        className: student.className || user.className || "未分班",
        level: result.riskLevel,
        source: task.title || assessment.name,
        createdAt: new Date().toLocaleString(),
        status: "待确认",
        summary: outcome.triggeredRules.length
          ? "关键题规则已触发，请由有权限人员及时人工复核。"
          : "风险标准分达到关注阈值，请结合实际情况人工复核。"
      });
      wx.setStorageSync("riskEvents", riskEvents);
    }

    if (this.data.draftKey) wx.removeStorageSync(this.data.draftKey);
    if (this.data.taskId) {
      tasks = tasks.map(function(task) { if (task.id === parseInt(this.data.taskId)) task.completed = true; return task; }, this);
      wx.setStorageSync("assessmentTasks", tasks);
    }
    wx.redirectTo({
      url: "/pages/assessment/result?id=" + id + "&resultId=" + result.id + "&readonly=1"
    });
  }
});
