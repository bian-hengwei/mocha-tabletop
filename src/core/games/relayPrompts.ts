import {seeded,shuffle} from '../types';

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

export function makeRelayOpeningPrompts(count:number,seed:number,language:'zh'|'en'):string[][]{
 const ideas=shuffle([...IDEAS],seeded(seed));
 return Array.from({length:count},(_,seat)=>ideas.slice(seat*3,seat*3+3).map(pair=>pair[language==='en'?1:0]));
}
