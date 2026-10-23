import {seeded,shuffle} from '../types';
import type {WordPack} from '../types';

/** Original drawing ideas written for Mocha; no external word-bank data. */
const IDEAS:readonly (readonly [string,string])[]=[
 ['小熊在月亮上野餐','A bear picnics on the moon'],
 ['狐狸坐着茶杯去旅行','A fox sails in a teacup'],
 ['企鹅撑着一把蘑菇伞','A penguin holds a mushroom umbrella'],
 ['机器人给花园浇水','A robot waters a garden'],
 ['小猫骑自行车送面包','A cat delivers bread by bicycle'],
 ['鲸鱼背着一座灯塔','A whale carries a lighthouse'],
 ['兔子在云朵上钓鱼','A rabbit fishes from a cloud'],
 ['蜗牛背着迷你城堡','A snail carries a tiny castle'],
 ['章鱼同时弹三把吉他','An octopus plays three guitars'],
 ['雪人在沙滩上堆沙堡','A snowman builds a sandcastle'],
 ['刺猬推着一车气球','A hedgehog pushes a cart of balloons'],
 ['小狗在树屋里烤披萨','A dog bakes pizza in a treehouse'],
 ['松鼠驾驶南瓜火车','A squirrel drives a pumpkin train'],
 ['长颈鹿戴着围巾滑冰','A giraffe in a scarf goes skating'],
 ['河马在荷叶上跳舞','A hippo dances on a lily pad'],
 ['乌龟乘着风筝去上学','A turtle rides a kite to school'],
 ['熊猫用竹子搭火箭','A panda builds a bamboo rocket'],
 ['小鸟在靴子里种草莓','A bird grows strawberries in a boot'],
 ['青蛙在雨中打鼓','A frog plays drums in the rain'],
 ['猫头鹰在星空下读书','An owl reads under the stars'],
 ['骆驼驮着一台冰箱','A camel carries a refrigerator'],
 ['小象给彩虹刷颜色','An elephant paints a rainbow'],
 ['海豹把贝壳当电话','A seal uses a shell as a phone'],
 ['浣熊在树枝上晾袜子','A raccoon hangs socks on a branch'],
 ['螃蟹搬着一块大蛋糕','A crab carries a giant cake'],
 ['小猪穿着雨靴踩水坑','A pig in rain boots jumps in puddles'],
 ['水獭躺在西瓜船里','An otter floats in a watermelon boat'],
 ['蝴蝶给花朵拍照','A butterfly photographs a flower'],
 ['山羊在屋顶上喝茶','A goat drinks tea on a roof'],
 ['鸭子排队坐滑梯','Ducks line up for a slide'],
 ['小鹿用树叶做帽子','A deer makes a leaf hat'],
 ['狮子在洗衣机旁等围巾','A lion waits for a scarf by a washing machine'],
 ['袋鼠用口袋装星星','A kangaroo fills its pouch with stars'],
 ['海马在珊瑚间放风筝','A seahorse flies a kite among corals'],
 ['小龙喷出一串泡泡','A little dragon blows bubbles'],
 ['老鼠用奶酪搭桥','A mouse builds a cheese bridge'],
];

/** Original prompts drawn from everyday digital and social life. */
const MODERN_IDEAS:readonly (readonly [string,string])[]=[
 ['一个人举着自拍杆和全家合影','A person takes a family selfie with a stick'],
 ['外卖员骑车穿过雨中的街口','A delivery rider crosses a rainy intersection'],
 ['咖啡师指引顾客扫码付款','A barista shows a customer how to scan and pay'],
 ['扫地机器人绕着一只睡着的猫','A robot vacuum circles a sleeping cat'],
 ['朋友视频通话时展示新买的毛绒挂件','Friends show a new plush keychain during a video call'],
 ['两人在共享厨房一起做晚餐','Two people cook dinner in a shared kitchen'],
 ['快递柜前一个人抱着三个纸箱','A person carries three parcels to a locker'],
 ['路人用手机给街头乐队直播','A passerby livestreams a street band on a phone'],
 ['小狗戴着智能项圈在公园奔跑','A dog with a smart collar runs through a park'],
 ['健身者用智能手表查看跑步距离','A runner checks the distance on a smart watch'],
 ['地铁里有人戴着降噪耳机听播客','A subway rider listens to a podcast in noise-canceling headphones'],
 ['朋友隔着屏幕一起庆祝生日','Friends celebrate a birthday together across screens'],
 ['社区花园里邻居交换番茄种子','Neighbors swap tomato seeds in a community garden'],
 ['空气炸锅旁的人欢呼打开盖子','A cook cheers while opening an air fryer'],
 ['遥控车把零食送到沙发边','A toy car delivers snacks to the sofa'],
 ['青年在街角咖啡店拍照打卡','A young person takes a photo at a corner cafe'],
 ['朋友围坐在一起拆盲盒','Friends sit together and open a blind box'],
 ['智能门锁识别来送花的访客','A smart lock recognizes a flower delivery visitor'],
 ['一个人拖着行李箱等网约车','A traveler waits for a ride with a suitcase'],
 ['邻居在群聊里提醒电梯维修','A neighbor warns the group chat about elevator repairs'],
 ['大家把手机叠成一座小塔','People stack their phones into a little tower'],
 ['桌上摆着游戏手柄和披萨','A game controller and pizza share a table'],
 ['快递纸箱变成猫窝','A delivery box becomes a cat bed'],
 ['闹钟响起时枕边手机显示低电量','A phone by the pillow shows low battery as the alarm rings'],
 ['两人各自在家唱歌视频合唱','Two people sing a duet from their homes by video'],
 ['露营天幕下大家交换拍立得照片','Friends trade instant photos under a camping canopy'],
 ['一个人在阳台给绿植装自动浇水器','A person installs a plant waterer on a balcony'],
 ['宠物摄像头里出现偷吃饼干的小狗','A pet camera catches a dog stealing cookies'],
 ['跑步机上的企鹅追赶虚拟终点','A penguin chases a virtual finish line on a treadmill'],
 ['手机地图把迷路的乌龟指向公交站','A phone map points a lost turtle toward a bus stop']
];

export function makeRelayOpeningPrompts(count:number,seed:number,language:'zh'|'en',wordPack:WordPack='classic'):string[][]{
 const ideas=shuffle([...(wordPack==='modern'?MODERN_IDEAS:IDEAS)],seeded(seed));
 return Array.from({length:count},(_,seat)=>Array.from({length:3},(_,offset)=>ideas[(seat*3+offset)%ideas.length]).map(pair=>pair[language==='en'?1:0]));
}
