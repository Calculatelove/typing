import { segmentGraphemes } from '../input'
import type { Article, ArticleLanguage, ArticleLength } from './types'

const EN_A = 'Morning light settles over the quiet district while delivery riders check their batteries and choose calm routes through the waking streets. A baker lifts a metal shutter, a gardener waters young trees, and buses begin their steady loops. At every corner, patient travelers watch the signals, leave room for others, and move with care. The city does not hurry all at once. It gathers its rhythm from hundreds of small decisions, each one simple, useful, and kind. By the time the market opens, every lane carries a gentle current of work, conversation, and hopeful plans.'
const EN_B = 'After sunset, warm windows brighten the blocks beside the river. Electric riders glide past bookshops, studios, and late cafes without disturbing the evening walkers. A musician packs away a small keyboard, friends share directions beneath a streetlamp, and a cleaner guides a quiet cart toward the station. Reflections stretch across the pavement whenever a light changes. The route bends between gardens and old brick walls, offering a different view at every turn. Even during a long journey, a careful rider can notice the soft details that make an ordinary neighborhood feel welcoming and alive.'
const EN_C = 'A reliable trip begins before the wheels move. The rider checks the charge, adjusts the mirrors, fastens a helmet, and studies the first few turns. Weather can change the best route, so flexible plans matter more than perfect predictions. On crowded streets, extra distance creates time to respond. On empty streets, steady attention still matters because doors may open and animals may cross. Good travel is not a race against every clock. It is a sequence of clear choices that protects energy, respects neighbors, and leaves the rider ready for whatever waits beyond the next corner.'
const EN_D = 'The central park divides the busiest streets with a wide ribbon of shade. Commuters pass its ponds in the morning, students gather near the steps at noon, and families follow the curved paths after school. Riders slow near each entrance because people often change direction without warning. Beyond the trees, the road climbs toward a row of workshops where bright signs mark repair rooms and design spaces. The climb asks for patience, but the return offers a long view across rooftops. From there, the whole district looks connected by movement, color, and countless personal destinations. Every careful pause keeps this shared landscape welcoming.'
const EN_E = 'During a summer shower, the city sounds different. Tires whisper over wet pavement, water taps on awnings, and distant traffic becomes a low steady hum. A rider reduces speed before painted lines and avoids sudden turns on shining corners. Under a covered walkway, strangers make space for one another while the rain passes. Soon the clouds lift, drains carry the last streams away, and sunlight returns to glass towers in scattered pieces. The careful journey continues with clean air, cooler streets, and the pleasant knowledge that preparation made an unexpected change feel completely manageable. A steady pace preserves confidence and comfort.'
const EN_F = 'Near midnight, maintenance crews begin work that most travelers never see. They inspect lamps, repaint worn markings, trim branches, and test signals while the avenues are calm. A few riders cross the district on quiet errands, following temporary signs around each work zone. Slower travel gives everyone room to finish safely. The workers exchange brief waves with passing drivers and return to their careful routines. By dawn, barriers disappear, fresh lines guide the first commuters, and the streets seem naturally ready. Their smooth appearance hides many thoughtful hours of planning, cooperation, and precise effort.'

const ZH_A = '清晨的街区从微小声音中醒来。面包店拉起卷门，园丁给新树浇水，第一班电车沿河岸缓缓经过。骑手检查电量和头盔，再选择熟悉的路线。路口灯光依次变化，行人留意彼此方向，车辆保持距离。市场开门时，道路已有温和交谈和新的计划。'
const ZH_B = '傍晚以后，河边窗户亮起暖色灯光。电动车穿过书店、工作室和小餐馆之间的弯道，没有打扰散步的人。音乐家收好键盘，朋友在路灯下确认方向。信号变化时，倒影在路面慢慢移动。沿途有花园、旧砖墙和广场，每次转弯都能看到不同景象。'
const ZH_C = '可靠的旅程在车轮转动前开始。骑手查看电量，调整后视镜，系好头盔，并记住几个路口。天气可能改变路线，所以灵活判断比完美预测更重要。拥挤街道上，多留一点距离就多一份反应时间；安静街道上，也要注意车门和小动物。'
const ZH_D = '中央公园如绿色带，把街道分成两边。早晨通勤者经过池塘，中午学生坐在台阶旁，放学后家庭沿小路散步。入口附近要减速，因为行人可能改变方向。树林外，道路向维修工坊上升。回程能看见屋顶，街区仿佛被目的地连接起来。'
const ZH_E = '夏日阵雨让城市换了一种声音。轮胎划过湿润路面，雨点敲打遮棚，远处交通变成低缓回响。骑手在标线前减速，避免在发亮弯角突然转向。人们在走廊下互相让出位置。云层移开后，旅程继续，充分准备让变化变得平稳。'
const ZH_F = '午夜时，维护人员处理白天的工作。他们检查路灯，补画标线，修剪树枝，并测试信号。骑手按照临时标志绕过施工区，较慢速度留下安全空间。天亮前，围栏被收起，新线条引导通勤者。顺畅街道背后，藏着许多计划与合作。'

function createFixture(
  id: string,
  title: string,
  language: ArticleLanguage,
  length: ArticleLength,
  text: string,
  tags: readonly string[],
): Article {
  const normalizedText = text.normalize('NFC')
  const scoredGraphemeCount = segmentGraphemes(normalizedText).length
  const wordCount = language === 'english'
    ? normalizedText.trim().split(/\s+/u).filter(Boolean).length
    : 0
  const scoredUnitsAt50 = language === 'english' ? wordCount : scoredGraphemeCount
  return {
    id,
    title,
    language,
    length,
    text: normalizedText,
    scoredGraphemeCount,
    wordCount,
    estimatedSecondsAt50: scoredUnitsAt50 / 50 * 60,
    sourceType: 'original-fixture',
    sourceLabel: 'Typing Gaming 原创 fixture',
    sourceUrl: null,
    license: '项目原创',
    tags,
  }
}

export const FIXTURE_ARTICLES: readonly Article[] = [
  createFixture('en-short-morning-current', 'Morning Current', 'english', 'short', EN_A, ['city', 'morning']),
  createFixture('en-short-river-lights', 'River Lights', 'english', 'short', EN_B, ['city', 'evening']),
  createFixture('en-medium-ready-route', 'The Ready Route', 'english', 'medium', `${EN_A} ${EN_C}`, ['safety', 'journey']),
  createFixture('en-medium-park-climb', 'Park and Workshop', 'english', 'medium', `${EN_B} ${EN_D}`, ['park', 'community']),
  createFixture('en-long-weather-wise', 'Weather Wise', 'english', 'long', `${EN_A} ${EN_C} ${EN_E}`, ['weather', 'safety']),
  createFixture('en-long-night-care', 'Night Street Care', 'english', 'long', `${EN_B} ${EN_D} ${EN_F}`, ['night', 'community']),
  createFixture('zh-short-morning-current', '清晨街区', 'chinese', 'short', ZH_A, ['城市', '清晨']),
  createFixture('zh-short-river-lights', '河岸灯光', 'chinese', 'short', ZH_B, ['城市', '傍晚']),
  createFixture('zh-medium-ready-route', '从容出发', 'chinese', 'medium', `${ZH_A}${ZH_C}`, ['安全', '旅程']),
  createFixture('zh-medium-park-climb', '公园与工坊', 'chinese', 'medium', `${ZH_B}${ZH_D}`, ['公园', '街区']),
  createFixture('zh-long-weather-wise', '雨后继续前行', 'chinese', 'long', `${ZH_A}${ZH_C}${ZH_E}`, ['天气', '安全']),
  createFixture('zh-long-night-care', '午夜维护', 'chinese', 'long', `${ZH_B}${ZH_D}${ZH_F}`, ['夜晚', '合作']),
]
