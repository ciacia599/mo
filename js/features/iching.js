/**
 * iching.js — 周易六十四卦 · 起卦解卦
 * 摇钱法起卦（三枚铜钱六次）+ 64 卦卦辞原文 + 白话解卦（含爱情/事业/建议）
 * 全部卦名卦辞为《周易》原文简录；解卦为白话参考。
 * 暴露：pgOpenIching
 */

/* ============ 六十四卦数据 [名称, 二进制(自下而上,1阳0阴), 卦辞原文, 白话解卦, 爱情, 事业/学业] ============ */
const YJ64 = [
    ['乾为天','111111','元亨利贞。','刚健有力，如日中天。此卦大吉，象征创造力与行动力达到顶点，但仍需戒骄戒躁，保持谦逊。','感情升温迅猛，主动一点会有好结果；记得把节奏放在两人都舒服的程度。','事业学业正处于上升期，大胆推进计划，但别把弦绷太紧。'],
    ['坤为地','000000','元亨，利牝马之贞。君子有攸往，先迷后得主。','厚德载物，以柔克刚。此时宜顺势而为、静待时机，跟随对的引路人反而事半功倍。','包容与倾听是这阶段的法宝，退一步海阔天空。','宜执行与积累，不宜强出头；踏实做事自有回报。'],
    ['水雷屯','100010','元亨利贞。勿用有攸往，利建侯。','万事开头难，种子破土前的黑暗。别急着远行，先扎根、找盟友，熬过初始的混沌就是新生。','刚萌芽的感情容易卡壳，多些耐心沟通，别因一时别扭放弃。','项目起步期困难多，先搭班子、积资源，不冒进。'],
    ['山水蒙','010001','亨。匪我求童蒙，童蒙求我。','蒙昧初开，求知若渴。放低姿态虚心求教，问题会迎刃而解；切忌再三试探他人诚意。','坦诚说出困惑比互相猜心有用，一次认真的深聊胜过百次试探。','学习中遇到瓶颈，找个好老师或前辈请教，会有豁然开朗之感。'],
    ['水天需','111010','有孚，光亨，贞吉。利涉大川。','等待也是一种力量。时机未到时蓄力储备，心怀诚信地等，该来的都在路上。','感情需要小火慢炖，别催促对方表态，安静的陪伴最动人。','目标已清晰但时机未熟，把准备做足，一旦机会出现立刻出手。'],
    ['天水讼','010111','有孚窒惕，中吉，终凶。利见大人。','争讼之卦：纠纷易起，纵有理也宜适可而止。退让和解是上策，缠斗到底两败俱伤。','为小事拌嘴不可怕，可怕的是争输赢；先低头的人赢了整段关系。','与同事伙伴意见相左，寻求中立第三方调停，别把矛盾公开化。'],
    ['地水师','010000','贞，丈人吉，无咎。','兴师动众，纪律为先。做事要有章法、有纪律，选对领军之人，则出师有名、战之能胜。','感情里要讲「规则感」，兑现承诺比说漂亮话更重要。','团队作战的时期，明确分工与纪律，跟着有经验的人走。'],
    ['水地比','000010','吉。原筮元永贞，无咎。','亲近相依，吉卦。真诚地靠近值得的人，圈子和谐则诸事顺遂；但择友需慎，晚来的 beware。','亲密度上升期，多制造两人相处时光，关系会更进一步。','合作运佳，主动结盟、资源共享，抱团取暖胜过单打独斗。'],
    ['风天小畜','111011','亨。密云不雨，自我西郊。','小有积蓄，力量暂不足以成大事。云已密、雨未落，再养一养实力，别急着亮底牌。','好感在悄悄累积，还没到捅破窗纸的时候，让暧昧再保温一会。','小有成绩但不足夸耀，继续低调蓄力，等待放量突破。'],
    ['天泽履','110111','履虎尾，不咥人，亨。','踩到老虎尾巴却无恙——以礼行事、如履薄冰，则险中得吉。谨言慎行是这个阶段的护身符。','关系里有敏感地带，说话前多想三秒，温柔谨慎反而能化解暗礁。','身处微妙环境，行事讲规矩、留余地，可保平安过关。'],
    ['地天泰','111000','小往大来，吉，亨。','天地交泰，大吉之卦。上下相通、内外调和，正是顺水行舟、大展宏图之时。','心有灵犀，默契值满分，适合谈未来、见家长、做重大决定。','万事通达，推动搁置已久的计划，成功概率极高。'],
    ['天地否','000111','否之匪人，不利君子贞，大往小来。','闭塞不通，诸事阻滞。此非绝境而是蛰伏期：收敛锋芒、静守待变，否极泰来有定时。','容易互相误解、话不投机，给彼此一点空间，别在气头上做决定。','进展不顺多半是环境问题，守住基本盘，等待周期翻转。'],
    ['天火同人','101111','同人于野，亨。利涉大川。','志同道合者相聚于旷野，坦荡无私则亨通。大目标需要大团结，真诚是唯一的策略。','愿意为彼此融入对方的圈子，是关系升温的信号，放心去引入新朋友吧。','适合寻找伙伴共谋大事，价值观一致比能力互补更重要。'],
    ['火天大有','111101','元亨。','大有收获，如日中天。丰盛之时最忌骄奢，懂得分享与节制，好运才能绵长。','感情富足而被滋养，别吝啬表达感激，把好运分给对方一半。','收获期到了，落袋为安；同时提防得意忘形埋下的隐患。'],
    ['地山谦','001000','亨，君子有终。','谦谦君子，山藏于地。越是优秀越要低调，谦逊者人皆助之，终有善果。','放下面子与骄傲，一句真诚的「我需要你」能融化所有隔阂。','功劳不分完、话说七分，谦虚让你的路越走越宽。'],
    ['雷地豫','000100','利建侯行师。','喜悦预备之卦。顺境中未雨绸缪，快乐而不放纵，方能常乐。','享受当下的甜蜜没问题，但也要聊聊现实规划，让快乐有根。','状态松弛、灵感涌现，是制定新计划的好时机。'],
    ['泽雷随','100110','元亨利贞，无咎。','随顺之道。择善而从、顺势而行，不固执己见，路自然走得通。','偶尔放下主见跟着对方走一趟，会发现不一样的风景。','跟随成熟团队或趋势行动，此刻不宜另起炉灶。'],
    ['山风蛊','011001','元亨，利涉大川。先甲三日，后甲三日。','积弊需整治。旧问题拖久了会发酵，现在正是刮骨疗毒、整顿重组的最佳窗口。','关系里积压的老矛盾该摊开谈了，彻底翻篇才能轻装前行。','审视旧项目、旧流程，大刀阔斧改革，此后可涉大川。'],
    ['地泽临','110000','元亨利贞。至于八月有凶。','君临之势渐盛，蒸蒸日上。但盛极需防衰，居安思危，好运方能持久。','感情正热络，趁势多投入；同时保持自我，别在爱里完全失重。','上升期一切顺利，但请提前布局「八月之忧」，留好后手。'],
    ['风地观','000011','盥而不荐，有孚颙若。','观察审视之卦。多看多学少表态，站得高才能看得远，心中有敬畏，行事有分寸。','先观察对方的心意与节奏，看清了再行动，此刻不急于表白或承诺。','调研学习期，多收集信息、观摩高手，谋定而后动。'],
    ['火雷噬嗑','100101','亨。利用狱。','咬合除障，如齿断物。遇到阻碍要果断「咬断」，明辨是非、赏罚分明，则畅通无阻。','把妨碍感情的「梗」当面咬开：说清楚、立规矩，从此清爽。','扫清流程中的障碍与蛀虫，需要一点铁腕和原则。'],
    ['山火贲','101001','亨。小利有攸往。','装饰之美，文质相映。外在的仪式感为生活增色，但质胜于文，别本末倒置。','适合安排有仪式感的约会：一顿精致的晚餐、一份用心的小礼物。','注重包装与呈现的时刻，提案、展示、形象管理都能加分。'],
    ['山地剥','000001','不利有攸往。','剥落之象，旧事物瓦解。此时不宜冒进，宜稳住根基、剥去浮华，守住核心等新机。','关系可能正在「褪皮」：去掉不切实际的幻想，看看真实的彼此是否仍愿意相拥。','运势剥蚀期，收缩战线、保存实力，拒绝高风险动作。'],
    ['地雷复','100000','亨。出入无疾，朋来无咎。七日来复。','一阳来复，生机重启。迷失后回归正道，循环往复中蕴含新生的力量。','破镜重圆或重归于好的吉兆，旧情复燃时别再犯同样的错。','低谷已见底，接下来是七日来复的反弹期，可小幅行动。'],
    ['天雷无妄','100111','元亨利贞。其匪正有眚，不利有攸往。','无妄之诚：依正道而行则大顺，起妄念、走捷径则招灾。守住本心，不越界。','真诚是唯一的技巧，别试探、别套路，坦荡的爱最经得起风浪。','按计划与规矩推进，任何投机取巧的念头都要掐灭。'],
    ['山天大畜','111001','利贞。不家食吉，利涉大川。','大有蓄养，厚积薄发。学识、资源、实力都已充沛，宜出门远行、干大事。','两人都在成长为更好的自己，一起去经历更大的世界吧。','蓄力已足，正是跳槽、创业、迎大项目的窗口期。'],
    ['山雷颐','100001','贞吉。观颐，自求口实。','颐养之道：管好嘴巴——吃什么、说什么。观人观己，自食其力最踏实。','少说气话、多聊真心，语言的喂养决定感情的温度。','注意饮食健康与言语分寸；靠输出内容、手艺吃饭者吉。'],
    ['泽风大过','011110','栋桡。利有攸往，亨。','大过之时，非常之事。梁木弯曲，需以非常之举扶正：非常时期要有决断与担当。','感情里出现了需要「壮士断腕」的问题，果断处理比拖着好。','压力超载，必须做减法或求援，硬扛只会断裂。'],
    ['坎为水','010010','有孚，维心亨，行有尚。','重重险陷，如行流水险滩。唯守诚信、保持初心，步步为营，方能涉险而过。','感情正处于考验期，彼此的信任是唯一的救生圈，别在深水里撒手。','险难重重，切忌孤注一掷；小步慢走、练好内功。'],
    ['离为火','101101','利贞，亨。畜牝牛，吉。','光明附丽，如火需柴。依附正道则光明磊落，以柔顺持之，可长明不熄。','热烈的爱要学着温柔地烧，彼此依附而不吞噬，才能长明。','才华被看见的时刻，附力于好平台、好贵人，光才留得住。'],
    ['泽山咸','001110','亨，利贞，取女吉。','山泽通气，交感之卦。两心相悦、彼此呼应，是六十四卦中最经典的婚恋吉卦之一。','心动的信号最强！心有灵犀一点通，表白、牵手、进一步都是好时机。','灵感与机遇相互感应，主动出击，贵人运旺。'],
    ['雷风恒','011100','亨，无咎，利贞。利有攸往。','恒久之道。雷风相与，动而相承：长久的感情与事业靠的不是激情而是持守。','爱到细水长流的阶段了，把「我爱你」变成每天的柴米油盐。','坚持既定路线不动摇，复利正在悄悄发生。'],
    ['天山遁','001111','亨，小利贞。','遁世避害。小人渐长时，聪明人选择退避三舍：远离消耗，保存元气。','关系需要冷却期或距离感时，得体地退后一步，反而留住体面。','环境不友好时别硬刚，暂避锋芒、进修充电，来日再战。'],
    ['雷天大壮','111100','利贞。','雷震天上，声势浩大。力量充沛正当用，但须「非礼弗履」——强而守正，方为大壮。','热情高涨，但强扭的瓜不甜，尊重对方意愿的爱才有力量。','势头正猛，乘势扩张；但记得用力七分留三分，防止过刚易折。'],
    ['火地晋','000101','康侯用锡马蕃庶，昼日三接。','日出地上，晋升之卦。如太阳冉冉升起，才华被看见、被嘉奖，步步高升。','关系明朗化：从暧昧到确定，从背地喜欢到正大光明地偏爱。','晋升、获奖、被重用的好时机，光明磊落者受益最大。'],
    ['地火明夷','101000','利艰贞。','光明入地，贤者受伤。晦暗之时韬光养晦，心中有大明，静待云开月明。','对方或许正经历低谷，你的理解与默默陪伴就是最亮的光。','怀才不遇或环境昏暗，藏起锋芒保全自己，等待天亮。'],
    ['风火家人','101011','利女贞。','风自火出，家人之卦。家是讲爱的地方：各正其位、彼此滋养，家和则万事兴。','谈婚论嫁、见家长、同居装修……「一家人」的课题提上日程，是好兆头。','团队如家，内部和睦是外部成功的基石，先安内后攘外。'],
    ['火泽睽','110101','小事吉。','二女同居，其志不同行。分歧显现，宜求同存异、大事化小，别上纲上线。','口味、作息、三观的小差异浮出水面，用幽默化解，别较真对错。','团队意见分裂，先做小事积累信任，大事缓议。'],
    ['水山蹇','001010','利西南，不利东北。利见大人，贞吉。','行路蹇难，前有险阻。知难而退、绕道而行是智慧，同时别忘了求助「大人」。','感情正遇现实阻力（异地、家庭、经济），携手绕行比硬闯聪明。','项目遇堵点，换赛道或换方法，并主动寻求前辈提携。'],
    ['雷水解','010100','利西南。无所往，其来复吉。有攸往，夙吉。','春雷行雨，百冻皆解！困扰已久的难题迎来化解之机，宜速不宜拖。','误会冰释前嫌，冷战迅速结束；有话趁热说，感情迅速回暖。','问题出现转机，趁热打铁尽快解决，拖延会再结冰。'],
    ['山泽损','110001','有孚，元吉，无咎。可贞。利有攸往。曷之用？二簋可用享。','损下益上，减之又减。放下执念与冗余，哪怕粗茶淡饭，心意到则大吉。','为爱「吃亏」是福：主动让渡一点自我，关系反而更甜。','做减法的时期：砍掉低效投入，聚焦核心，以诚补质。'],
    ['风雷益','100011','利有攸往，利涉大川。','风雷相益，损上益下。给予者得道多助，此刻利涉大川——大胆去做利人利己之事。','多为对方「投资」：时间、耐心、惊喜，存进感情账户都会翻倍返还。','公益、帮扶、分享资源都会带来意外的机遇回馈。'],
    ['泽天夬','111110','扬于王庭，孚号有厉。告自邑，不利即戎，利有攸往。','决断之卦：当断则断，光明正大地了断。除恶劣尽，但要以理服人、不诉诸暴力。','是时候对暧昧不明的状态做个了断了：要么确定关系，要么体面告别。','果断处置悬而未决的事项，摊开来讲，长痛不如短痛。'],
    ['天风姤','011111','女壮，勿用取女。','不期而遇之卦。突如其来的邂逅或机会暗藏玄机，惊艳的第一眼未必可靠，慢一点。','有新的心动对象出现？先观察人品再靠近，谨防上头。','意外的机会主动找上门，评估风险别急着签，细看合同。'],
    ['泽地萃','000110','亨。王假有庙，利见大人，亨，利贞。用大牲吉。','萃聚之卦：人聚、财聚、缘聚。召集同类、虔诚祭祀，把力量聚拢起来可成大事。','适合「官宣」的时机！让关系在众人见证下落地生根。','团队集结、资源汇拢，办活动、做社群、组局皆宜。'],
    ['地风升','011000','元亨，用见大人，勿恤，南征吉。','木生地中，节节攀升。积累到位，上升通道已开，拜访贵人、大胆前进皆吉。','感情如植物拔节生长，认真规划共同的未来吧，方向朝上。','升职加薪之象，主动争取更大的舞台，不必忧虑。'],
    ['泽水困','010110','亨，贞，大人吉，无咎。有言不信。','困顿之卦：泽中无水，有口难言。身处困局，最好的策略是安守本心、少说话多做事。','现在的沉默不是不爱，是暂时无能为力；给彼此熬过去的信念。','资源紧张的时期，咬牙守住底线，困境正是大人物的炼金石。'],
    ['水风井','011010','改邑不改井，无丧无得，往来井井。','井养之德：不变其位而养人不穷。修炼自己的「井水」，来的人自然取之不尽。','做那个稳定供给温暖的人，你们的关系会成为彼此的能量井。','深耕专业与口碑，城池可迁，手艺与信誉跟你一辈子。'],
    ['泽火革','101110','巳日乃孚，元亨利贞，悔亡。','革故鼎新，如豹变文炳。时机成熟时大胆变革，人心归附，旧貌换新颜。','关系模式该升级了：告别旧相处的疲惫感，一起创造新的相处方式。','转型、改版、换赛道的吉时，先取得信任再推改革。'],
    ['火风鼎','011101','元吉，亨。','鼎新之卦：烹饪化生，养贤之器。格局重组后人才各得其所，事业如鼎之三足稳立。','两个人像新家的新锅灶，一起「烹饪」属于你们的生活滋味。','重组团队、搭建体系，网罗贤才者大吉。'],
    ['震为雷','100100','亨。震来虩虩，笑言哑哑。震惊百里，不丧匕鬯。','惊雷骤响，处变不惊者吉。突发状况考验的是定力：泰山崩于前而面不改色。','关系里的「突发雷」别慌，稳住阵脚好好沟通，风波过后感情更韧。','突然的变故或机会，处变不惊、按部就班者脱颖而出。'],
    ['艮为山','001001','艮其背，不获其身；行其庭，不见其人。无咎。','两山相重，止之又止。当行则行、当止则止，停在正确的位置上就是最好的行动。','急流勇退不是懦弱：给彼此按下暂停键，感情需要留白的艺术。','知止的智慧：项目扩张到临界点时，主动刹车守成。'],
    ['风山渐','001011','女归吉，利贞。','鸿雁渐进，循序渐进之卦。如女子出嫁循六礼，凡事按次序推进则吉。','感情按部就班：从朋友到恋人到家人，每一步都走得踏实，此卦利婚嫁。','按里程碑推进的项目最稳，别跳步骤，一步步来。'],
    ['雷泽归妹','110100','征凶，无攸利。','少女方长而遽嫁，根基未稳。仓促行事多悔，感情与决策皆忌「赶进度」。','别被催促或冲动推着走：婚嫁、表白若时机未熟，宁可缓一缓。','条件不成熟就别强推，先补齐短板再出发。'],
    ['雷火丰','101100','亨，王假之。勿忧，宜日中。','雷火丰茂，盛大之极。日中则昃，盛时当思守成：主动分享光明，勿惧勿骄。','感情正盛大热烈，珍惜当下并互相坦露真心，这一刻值得铭记。','事业巅峰期，大张旗鼓地干；同时注意峰值后的节奏管理。'],
    ['火山旅','001101','小亨，旅贞吉。','旅行在外，寄人篱下。柔顺中庸则小有亨通；漂泊之时，谨言慎行、多结善缘。','一起旅行能看清彼此：旅途中的照顾与包容，是感情的试金石。','处于漂泊过渡期，低调务实，广结善缘会有意外之助。'],
    ['巽为风','011011','小亨，利有攸往，利见大人。','风行无孔不入，以柔渗透。此时不宜硬碰硬，像风一样柔和地持续发力。','润物细无声的关心比轰轰烈烈更打动人，温柔渗透吧。','以沟通与柔性手段推进事务，寻求上位者的支持。'],
    ['兑为泽','110110','亨，利贞。','两泽相连，喜悦相通。以诚悦人、互惠共享，朋友多则快乐多，但勿沉溺享乐。','你们是最好的玩伴也是恋人，一起制造更多快乐的回忆吧。','适合谈判、社交、协作，好口才与好脾气带来双赢。'],
    ['风水涣','010011','亨。王假有庙，利涉大川，利贞。','风行水上，涣散中有机。人心涣散时需重聚精神，凝聚共识则可涉大川。','若感觉彼此渐行渐远，一起做件有仪式感的事把心重新聚拢。','团队需要重塑愿景与凝聚力，立旗帜、定同心之约。'],
    ['水泽节','110010','亨。苦节不可贞。','节制有度则亨通。但「苦节」不可持久——张弛有度才是真节制，别把自己勒太紧。','为感情立一些小约定（如睡前说晚安），但别用规矩绑架彼此。','预算、时间、精力做规划，留出弹性空间。'],
    ['风泽中孚','110011','豚鱼吉，利涉大川，利贞。','中心诚信，感动豚鱼。至诚可以感化最顽固的心，信任是涉险渡川的舟楫。','彻底的坦诚带来彻底的信任，把心底话温柔地说出来吧。','诚信经营带来口碑爆发，此刻承诺的事务必兑现。'],
    ['雷山小过','001100','亨，利贞。可小事，不可大事。飞鸟遗之音，宜下不宜上。','小有过越，小事可为，大事难成。如飞鸟宜低不宜高：低调行事，小事精进。','用小惊喜、小体贴去经营感情就好，重大决定再等等。','执行层面的优化改进皆宜，战略级大动作暂缓。'],
    ['水火既济','101010','亨小，利贞。初吉终乱。','大功告成，水火相济。圆满之时正是生变之始：守成如创业，警惕「终乱」。','修成正果的吉卦！但热恋变日常后更要用心保鲜。','目标达成，别松懈：复盘固化成果，防止盛极而衰。'],
    ['火水未济','010101','亨。小狐汔济，濡其尾，无攸利。','未完成，如小狐渡河濡湿尾巴。事情接近终点却尚有余波，慎终如始，方得圆满。','关系还在「未完成」的进行时，别急着要一个结局，把每一步走稳。','最后关头最容易翻车，收尾工作做到位，功成不必抢在今晚。']
];
const YJ_BY_BIN = {}; YJ64.forEach((h, i) => YJ_BY_BIN[h[1]] = i);

/* ============ 模态框 ============ */
function yjEnsureModal() {
    if (document.getElementById('pg-yj-modal')) return;
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'pg-yj-modal';
    modal.style.zIndex = '9100';
    modal.innerHTML = `<div class="modal-content" style="max-width:480px; padding:16px; max-height:84vh; overflow-y:auto;">
        <div id="pg-yj-body"></div>
    </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) yjClose(); });
}
function yjClose() { hideModal(document.getElementById('pg-yj-modal')); }
function yjSetBody(html) { document.getElementById('pg-yj-body').innerHTML = html; }
function yjBtn(label, onclick, primary) {
    const bg = primary === false ? 'var(--primary-bg)' : 'var(--accent-color)';
    const color = primary === false ? 'var(--text-primary)' : '#fff';
    const border = primary === false ? '1px solid var(--border-color)' : 'none';
    return `<button onclick="${onclick}" style="padding:9px 14px; border-radius:10px; border:${border}; background:${bg}; color:${color}; font-size:13px; font-weight:600; cursor:pointer;">${label}</button>`;
}
function yjCard(title, inner) {
    return `<div style="background:var(--secondary-bg); border:1px solid var(--border-color); border-radius:14px; padding:14px; margin-bottom:12px;">
        ${title ? `<div style="font-size:13px; font-weight:700; color:var(--text-primary); margin-bottom:10px;">${title}</div>` : ''}${inner}
    </div>`;
}
window.pgOpenIching = function () {
    yjEnsureModal();
    showModal(document.getElementById('pg-yj-modal'));
    yjViewCast();
};
function yjTabs(cur) {
    return `<div style="display:flex; align-items:center; gap:8px; margin-bottom:14px;">
        <button onclick="yjViewCast()" style="flex:1; padding:9px; border-radius:10px; font-size:13px; font-weight:700; cursor:pointer; border:1.5px solid ${cur === 'cast' ? 'var(--accent-color)' : 'var(--border-color)'}; background:var(--primary-bg); color:var(--text-primary);">🔮 摇钱起卦</button>
        <button onclick="yjViewAll()" style="flex:1; padding:9px; border-radius:10px; font-size:13px; font-weight:700; cursor:pointer; border:1.5px solid ${cur === 'all' ? 'var(--accent-color)' : 'var(--border-color)'}; background:var(--primary-bg); color:var(--text-primary);">📜 六十四卦</button>
        <button onclick="yjClose()" style="width:30px; height:30px; border-radius:50%; border:1px solid var(--border-color); background:var(--primary-bg); color:var(--text-secondary); cursor:pointer; font-size:16px;">×</button>
    </div>`;
}
/* 卦画渲染（binary 自下而上，渲染时自上而下） */
function yjGlyph(bin, big) {
    const rows = bin.split('').reverse().map(b => b === '1'
        ? `<div style="height:${big ? 8 : 5}px; background:#333; border-radius:2px; margin:${big ? 5 : 3}px auto; width:${big ? 64 : 40}px;"></div>`
        : `<div style="display:flex; gap:${big ? 16 : 10}px; justify-content:center; margin:${big ? 5 : 3}px auto; width:${big ? 64 : 40}px;"><div style="flex:1; height:${big ? 8 : 5}px; background:#333; border-radius:2px;"></div><div style="flex:1; height:${big ? 8 : 5}px; background:#333; border-radius:2px;"></div></div>`).join('');
    return `<div style="padding:2px 0;">${rows}</div>`;
}
/* ============ 起卦 ============ */
let yjCasting = false;
function yjViewCast() {
    yjSetBody(yjTabs('cast') + `
        ${yjCard('铜钱摇卦', `
            <div style="font-size:12px; color:var(--text-secondary); margin-bottom:12px; line-height:1.8;">
                心中默念所问之事（问感情、问前程皆可），点击下方按钮，铜钱会自动摇六次、自下而上成卦。<br>三枚铜钱：一背为少阳 ▬，两背为少阴 ▬ ▬，三背为老阳（动爻 ○），三字为老阴（动爻 ×）。
            </div>
            <div id="yj-cast-area" style="min-height:60px; text-align:center; font-size:13px; color:var(--text-secondary); padding:6px 0;">（卦象将在这里生成）</div>
            <div style="text-align:center; margin-top:8px;">${yjBtn('🪙 摇卦（心诚则灵）', 'yjCast()')}</div>
        `)}
        <div id="yj-result"></div>
    `);
}
async function yjSleep(ms) { return new Promise(r => setTimeout(r, ms)); }
window.yjCast = async function () {
    if (yjCasting) return;
    yjCasting = true;
    const area = document.getElementById('yj-cast-area');
    const res = document.getElementById('yj-result');
    if (res) res.innerHTML = '';
    const lines = [];       // 自下而上 {v:0/1, moving:bool}
    const names = { 6: '老阴 ×', 7: '少阳 ▬', 8: '少阴 ▬ ▬', 9: '老阳 ○' };
    for (let i = 0; i < 6; i++) {
        // 三枚铜钱：3=阳面 2=阴面
        let sum = 0, rolls = [];
        for (let c = 0; c < 3; c++) { const v = Math.random() < 0.5 ? 3 : 2; sum += v; rolls.push(v); }
        lines.push({ v: (sum === 7 || sum === 9) ? 1 : 0, moving: sum === 6 || sum === 9 });
        if (area) area.innerHTML = lines.map((l, idx) =>
            `<div style="display:flex; justify-content:space-between; align-items:center; padding:3px 6px; font-size:12px; color:var(--text-secondary);">
                <span>${['初', '二', '三', '四', '五', '上'][idx]}爻</span>
                <span>${yjMiniGlyph(l.v)}${l.moving ? (l.v ? ' ○动' : ' ×动') : ''}</span>
                <span>${names[{ 6: 6, 7: 7, 8: 8, 9: 9 }[(l.moving ? (l.v ? 9 : 6) : (l.v ? 7 : 8))]]}</span>
            </div>`).reverse().join('');
        try { if (typeof playSound === 'function') playSound('mood'); } catch (e) {}
        await yjSleep(420);
    }
    const bin = lines.map(l => l.v).join('');
    const movingIdx = lines.map((l, i) => l.moving ? i : -1).filter(i => i >= 0);
    let changeBin = null;
    if (movingIdx.length) {
        const arr = lines.map(l => l.v);
        movingIdx.forEach(i => arr[i] = arr[i] ? 0 : 1);
        changeBin = arr.join('');
    }
    yjCasting = false;
    yjShowResult(bin, changeBin, movingIdx);
};
function yjMiniGlyph(v) {
    return v === 1
        ? `<span style="display:inline-block; width:34px; height:4px; background:#444; border-radius:2px; vertical-align:middle;"></span>`
        : `<span style="display:inline-flex; gap:8px; width:34px; vertical-align:middle;"><span style="flex:1; height:4px; background:#444; border-radius:2px;"></span><span style="flex:1; height:4px; background:#444; border-radius:2px;"></span></span>`;
}
function yjShowResult(bin, changeBin, movingIdx) {
    const h = YJ64[YJ_BY_BIN[bin]];
    const ch = changeBin ? YJ64[YJ_BY_BIN[changeBin]] : null;
    const res = document.getElementById('yj-result');
    if (!res) return;
    res.innerHTML = `
        ${yjCard('本卦', `
            <div style="display:flex; gap:14px; align-items:center;">
                <div style="background:#fff; border-radius:10px; padding:10px;">${yjGlyph(h[1], true)}</div>
                <div>
                    <div style="font-size:16px; font-weight:800; color:var(--text-primary);">${h[0]}</div>
                    <div style="font-size:12px; color:var(--text-secondary); margin-top:4px;">卦辞：${h[2]}</div>
                    ${movingIdx.length ? `<div style="font-size:11px; color:#E67E22; margin-top:4px;">动爻：${movingIdx.map(i => ['初', '二', '三', '四', '五', '上'][i] + '爻').join('、')}（卦有变动）</div>` : '<div style="font-size:11px; color:var(--text-secondary); margin-top:4px;">六爻安静（无事变动，以本卦断）</div>'}
                </div>
            </div>
        `)}
        ${yjCard('白话解卦', `<div style="font-size:13px; color:var(--text-primary); line-height:1.9;">${h[3]}</div>`)}
        ${yjCard('💗 感情', `<div style="font-size:12px; color:var(--text-primary); line-height:1.8;">${h[4]}</div>`)}
        ${yjCard('📈 事业 / 学业', `<div style="font-size:12px; color:var(--text-primary); line-height:1.8;">${h[5]}</div>`)}
        ${ch ? yjCard('🔄 变卦（事态走向）', `
            <div style="display:flex; gap:14px; align-items:center;">
                <div style="background:#fff; border-radius:10px; padding:8px;">${yjGlyph(ch[1], false)}</div>
                <div><div style="font-size:14px; font-weight:700; color:var(--text-primary);">${ch[0]}</div>
                <div style="font-size:12px; color:var(--text-secondary); margin-top:4px; line-height:1.7;">${ch[3]}</div></div>
            </div>`) : ''}
        <div style="font-size:11px; color:var(--text-secondary); text-align:center; margin-bottom:12px; opacity:0.75;">卦为参考，路在脚下 · 心诚则灵 🙏</div>
    `;
    if (res.scrollIntoView) try { res.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) {}
}
/* ============ 六十四卦一览 ============ */
function yjViewAll() {
    yjSetBody(yjTabs('all') + `
        <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:8px;">
            ${YJ64.map((h, i) => `
                <div onclick="yjViewOne(${i})" style="background:var(--primary-bg); border:1px solid var(--border-color); border-radius:10px; padding:8px 2px; text-align:center; cursor:pointer;">
                    <div style="transform:scale(0.55); transform-origin:center; margin:-14px 0 -10px;">${yjGlyph(h[1], false)}</div>
                    <div style="font-size:10px; color:var(--text-primary); font-weight:600;">${h[0].slice(0, 2)}</div>
                </div>`).join('')}
        </div>
        <div style="font-size:11px; color:var(--text-secondary); text-align:center; margin:12px 0; opacity:0.75;">点击任意卦象查看卦辞与解卦</div>
        <div id="yj-one"></div>
    `);
}
window.yjViewOne = function (i) {
    const h = YJ64[i];
    const box = document.getElementById('yj-one');
    if (!box) return;
    box.innerHTML = `
        ${yjCard(`${h[0]}`, `
            <div style="display:flex; gap:14px; align-items:center; margin-bottom:10px;">
                <div style="background:#fff; border-radius:10px; padding:10px;">${yjGlyph(h[1], true)}</div>
                <div style="font-size:12px; color:var(--text-secondary); line-height:1.8;">卦辞：${h[2]}</div>
            </div>
            <div style="font-size:13px; color:var(--text-primary); line-height:1.9; margin-bottom:8px;"><b>解卦：</b>${h[3]}</div>
            <div style="font-size:12px; color:var(--text-primary); line-height:1.8; margin-bottom:4px;"><b>💗 感情：</b>${h[4]}</div>
            <div style="font-size:12px; color:var(--text-primary); line-height:1.8;"><b>📈 事业：</b>${h[5]}</div>
        `)}`;
    try { box.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) {}
};
