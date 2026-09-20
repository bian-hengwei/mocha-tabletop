/** Original, bilingual everyday vocabulary. A match fixes its language at creation. */
export type WordLanguage='zh'|'en';
export const SIGNAL_WORDS:[string,string][]=[
 ['月亮','Moon'],['太阳','Sun'],['星星','Star'],['银河','Galaxy'],['火箭','Rocket'],['卫星','Satellite'],['宇航员','Astronaut'],['彗星','Comet'],['地球','Earth'],['轨道','Orbit'],
 ['森林','Forest'],['沙漠','Desert'],['海洋','Ocean'],['河流','River'],['冰川','Glacier'],['火山','Volcano'],['山峰','Mountain'],['洞穴','Cave'],['岛屿','Island'],['瀑布','Waterfall'],
 ['老虎','Tiger'],['熊猫','Panda'],['海豚','Dolphin'],['企鹅','Penguin'],['蝴蝶','Butterfly'],['蜘蛛','Spider'],['蜜蜂','Bee'],['鲸鱼','Whale'],['狐狸','Fox'],['乌龟','Turtle'],
 ['苹果','Apple'],['柠檬','Lemon'],['樱桃','Cherry'],['面包','Bread'],['奶酪','Cheese'],['咖啡','Coffee'],['茶叶','Tea'],['巧克力','Chocolate'],['蜂蜜','Honey'],['蘑菇','Mushroom'],
 ['钢琴','Piano'],['吉他','Guitar'],['鼓声','Drum'],['歌手','Singer'],['舞台','Stage'],['电影','Movie'],['画笔','Brush'],['相机','Camera'],['雕像','Statue'],['诗歌','Poem'],
 ['医生','Doctor'],['厨师','Chef'],['老师','Teacher'],['船长','Captain'],['侦探','Detective'],['农夫','Farmer'],['律师','Lawyer'],['园丁','Gardener'],['木匠','Carpenter'],['飞行员','Pilot'],
 ['城堡','Castle'],['桥梁','Bridge'],['灯塔','Lighthouse'],['港口','Harbor'],['机场','Airport'],['车站','Station'],['图书馆','Library'],['博物馆','Museum'],['医院','Hospital'],['剧院','Theater'],
 ['钥匙','Key'],['镜子','Mirror'],['时钟','Clock'],['雨伞','Umbrella'],['蜡烛','Candle'],['信封','Envelope'],['地图','Map'],['望远镜','Telescope'],['指南针','Compass'],['剪刀','Scissors'],
 ['王冠','Crown'],['宝石','Gem'],['黄金','Gold'],['银币','Silver'],['钻石','Diamond'],['珍珠','Pearl'],['盔甲','Armor'],['盾牌','Shield'],['长剑','Sword'],['旗帜','Flag'],
 ['足球','Football'],['篮球','Basketball'],['网球','Tennis'],['游泳','Swimming'],['滑雪','Skiing'],['象棋','Chess'],['赛车','Racing'],['跳舞','Dancing'],['拳击','Boxing'],['骑行','Cycling'],
 ['春天','Spring'],['夏天','Summer'],['秋天','Autumn'],['冬天','Winter'],['暴风','Storm'],['彩虹','Rainbow'],['雪花','Snowflake'],['闪电','Lightning'],['雾气','Fog'],['微风','Breeze'],
 ['电池','Battery'],['机器人','Robot'],['电脑','Computer'],['网络','Network'],['电话','Phone'],['激光','Laser'],['磁铁','Magnet'],['齿轮','Gear'],['引擎','Engine'],['电线','Wire'],
 ['火车','Train'],['飞机','Airplane'],['轮船','Ship'],['自行车','Bicycle'],['马车','Carriage'],['潜艇','Submarine'],['帆船','Sailboat'],['热气球','Balloon'],['卡车','Truck'],['摩托车','Motorcycle'],
 ['梦境','Dream'],['记忆','Memory'],['秘密','Secret'],['运气','Luck'],['时间','Time'],['影子','Shadow'],['声音','Sound'],['光线','Light'],['温度','Temperature'],['速度','Speed'],
 ['羽毛','Feather'],['翅膀','Wing'],['树根','Root'],['花瓣','Petal'],['种子','Seed'],['贝壳','Shell'],['珊瑚','Coral'],['竹子','Bamboo'],['松树','Pine'],['橡树','Oak']
];
export const ODD_WORD_PAIRS:[[string,string],[string,string]][]=[
 [['咖啡','Coffee'],['茶','Tea']],[['猫','Cat'],['狗','Dog']],[['太阳','Sun'],['月亮','Moon']],[['苹果','Apple'],['梨','Pear']],[['火车','Train'],['地铁','Subway']],
 [['电影','Movie'],['电视剧','Television series']],[['雨伞','Umbrella'],['雨衣','Raincoat']],[['面包','Bread'],['蛋糕','Cake']],[['足球','Football'],['篮球','Basketball']],[['钢琴','Piano'],['吉他','Guitar']],
 [['海洋','Ocean'],['湖泊','Lake']],[['蜜蜂','Bee'],['蝴蝶','Butterfly']],[['冰箱','Refrigerator'],['空调','Air conditioner']],[['手机','Phone'],['平板电脑','Tablet']],[['医生','Doctor'],['护士','Nurse']],
 [['老师','Teacher'],['教练','Coach']],[['饺子','Dumpling'],['包子','Steamed bun']],[['牛奶','Milk'],['酸奶','Yogurt']],[['盐','Salt'],['糖','Sugar']],[['铅笔','Pencil'],['钢笔','Pen']],
 [['手套','Gloves'],['袜子','Socks']],[['狮子','Lion'],['老虎','Tiger']],[['海豚','Dolphin'],['鲸鱼','Whale']],[['兔子','Rabbit'],['仓鼠','Hamster']],[['森林','Forest'],['公园','Park']],
 [['沙漠','Desert'],['沙滩','Beach']],[['瀑布','Waterfall'],['喷泉','Fountain']],[['雪花','Snowflake'],['冰雹','Hail']],[['风筝','Kite'],['气球','Balloon']],[['蜡烛','Candle'],['手电筒','Flashlight']],
 [['镜子','Mirror'],['照片','Photograph']],[['书店','Bookstore'],['图书馆','Library']],[['宾馆','Hotel'],['民宿','Guesthouse']],[['机场','Airport'],['车站','Station']],[['桥梁','Bridge'],['隧道','Tunnel']],
 [['电梯','Elevator'],['楼梯','Staircase']],[['钥匙','Key'],['密码','Password']],[['时钟','Clock'],['手表','Watch']],[['钱包','Wallet'],['背包','Backpack']],[['帽子','Hat'],['头盔','Helmet']],
 [['泳池','Swimming pool'],['浴缸','Bathtub']],[['滑雪','Skiing'],['滑冰','Skating']],[['跑步','Running'],['散步','Walking']],[['唱歌','Singing'],['跳舞','Dancing']],[['画画','Drawing'],['摄影','Photography']],
 [['巧克力','Chocolate'],['糖果','Candy']],[['橙子','Orange'],['柠檬','Lemon']],[['西瓜','Watermelon'],['哈密瓜','Melon']],[['草莓','Strawberry'],['樱桃','Cherry']],[['土豆','Potato'],['红薯','Sweet potato']],
 [['洋葱','Onion'],['大蒜','Garlic']],[['黄瓜','Cucumber'],['西葫芦','Zucchini']],[['寿司','Sushi'],['饭团','Rice ball']],[['汉堡','Burger'],['三明治','Sandwich']],[['披萨','Pizza'],['馅饼','Pie']],
 [['公交车','Bus'],['出租车','Taxi']],[['自行车','Bicycle'],['摩托车','Motorcycle']],[['轮船','Ship'],['帆船','Sailboat']],[['火箭','Rocket'],['飞机','Airplane']],[['卫星','Satellite'],['空间站','Space station']],
 [['国王','King'],['王子','Prince']],[['王冠','Crown'],['奖杯','Trophy']],[['宝石','Gem'],['珍珠','Pearl']],[['黄金','Gold'],['白银','Silver']],[['长剑','Sword'],['弓箭','Bow']],
 [['帐篷','Tent'],['小屋','Cabin']],[['地图','Map'],['指南针','Compass']],[['望远镜','Telescope'],['显微镜','Microscope']],[['相机','Camera'],['摄像机','Video camera']],[['耳机','Headphones'],['音箱','Speaker']],
 [['春天','Spring'],['秋天','Autumn']],[['夏天','Summer'],['冬天','Winter']],[['日出','Sunrise'],['日落','Sunset']],[['雷声','Thunder'],['闪电','Lightning']],[['彩虹','Rainbow'],['极光','Aurora']],
 [['围巾','Scarf'],['领带','Tie']],[['西装','Suit'],['礼服','Gown']],[['凉鞋','Sandals'],['拖鞋','Slippers']],[['筷子','Chopsticks'],['叉子','Fork']],[['盘子','Plate'],['碗','Bowl']]
];
export const localWord=(pair:[string,string],language:WordLanguage)=>pair[language==='en'?1:0];
