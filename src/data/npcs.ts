import {CAPITAL_NPC_COURTS} from './highmereComposition';
import {createHighmereResidents} from './highmereResidents';
import {HIGHMERE_SENTRY_ANCHORS} from './highmerePlan';
import type { NpcDefinition } from '../game/types';
import { CAPITAL_RESIDENTS, REGIONAL_WORKERS } from './capitalResidents';
import { CIBAR_RESIDENTS } from './cibarResidents';
import { WARD_RESIDENTS } from './wardResidents';
import {ROAD_RESIDENTS} from './roadResidents';
import { prepareNpcPresentation } from './npcPresentation';
import {CASTLE_RESIDENTS} from './castleResidents';
import {createSettlementResidents} from './settlementResidents';
import {STORY_RESIDENTS} from './storyResidents';
import {reviseNamedConversations} from './npcConversations';
import {ADVENTURE_QUEST_GIVERS} from './adventure';

export const NPCS: NpcDefinition[] = [
  {
    id: 'aldren-vale', name: 'Aldren Vale', title: 'Retired Roadwarden', townId: 'oakmere', role: 'Leigneron’s mentor and first combat teacher', spriteFrame: 0, spriteTexture:'npc_general',
    worldOffset: { x: -120, y: 80 }, weaponId: 'oak-shield-blade', combatant: true,
    schedule: [{ startHour: 6, activity: 'Trains beside the west fence' }, { startHour: 10, activity: 'Patrols Oakmere roads' }, { startHour: 18, activity: 'Eats at the inn' }, { startHour: 21, activity: 'Returns home' }],
    relationshipToLeigneron: { kind: 'mentor', trust: 85, summary: 'Aldren taught Leigneron swordwork, roadcraft, and how to read danger before drawing steel.' },
    dialogue: [
      'You are old enough to choose your own road now, Leigneron. That does not mean you should choose it carelessly.',
      'The eastern watchtower has gone quiet. Caravans are turning back, and that means trouble will reach Oakmere soon.',
      'Take your sword. Find out who holds the tower, and come back alive. I would rather scold you than bury you.'
    ],
    questIds: ['first-road', 'eight-regions'],
  },
  {
    id: 'mira-fen', name: 'Mira Fen', title: 'Herbalist Scout', townId: 'oakmere', role: 'Childhood friend, field scout, and early exploration companion', spriteFrame: 0, spriteTexture:'npc_huntress',
    worldOffset: { x: 150, y: 120 }, weaponId: 'narenthil-longbow', combatant: true,
    schedule: [{ startHour: 5, activity: 'Collects herbs north of Oakmere' }, { startHour: 11, activity: 'Works at the herb stall' }, { startHour: 17, activity: 'Practices archery' }, { startHour: 20, activity: 'Visits the inn' }],
    relationshipToLeigneron: { kind: 'friend', trust: 78, summary: 'Mira and Leigneron grew up taking the same roads, daring each other to travel farther every season.' },
    dialogue: ['You always look at the horizon like it owes you an answer.', 'If you head east, watch the tree line. Wolves have been ranging closer to the farms than usual.'],
    questIds: [],
  },
  {
    id: 'joren-pike', name: 'Joren Pike', title: 'Village Blacksmith', townId: 'oakmere', role: 'Blacksmith, weapon repairer, and family friend', spriteFrame: 0, spriteTexture:'npc_blacksmith',
    worldOffset: { x: 210, y: -120 }, weaponId: 'roadwarden-sword', combatant: true,
    schedule: [{ startHour: 6, activity: 'Opens the forge' }, { startHour: 12, activity: 'Trades and repairs equipment' }, { startHour: 19, activity: 'Closes the forge' }],
    relationshipToLeigneron: { kind: 'family-friend', trust: 72, summary: 'Joren repaired Leigneron’s first practice blade and has known the family for years.' },
    dialogue: ['A blade remembers bad maintenance longer than a swordsman does.', 'Bring me good ore from the east and I can make that old roadwarden sword bite harder.'],
    questIds: [],
  },
  {
    id: 'elara-voss', name: 'Elara Voss', title: 'Oakmere Guard Captain', townId: 'oakmere', role: 'Local authority, tactical ally, and gatekeeper to official Trandum contracts', spriteFrame: 0, spriteTexture: 'npc_guard',
    worldOffset: { x: -220, y: -130 }, weaponId: 'oak-shield-blade', combatant: true,
    schedule: [{ startHour: 5, activity: 'Inspects the village gate' }, { startHour: 9, activity: 'Runs the guard post' }, { startHour: 17, activity: 'Patrols farms' }, { startHour: 22, activity: 'Night watch rotation' }],
    relationshipToLeigneron: { kind: 'authority', trust: 45, summary: 'Elara respects Leigneron’s instincts but distrusts reckless heroics and expects results.' },
    dialogue: ['Aldren may indulge you. I will not.', 'If you want the guard to treat you like a roadwarden, bring me roadwarden results.'],
    questIds: [],
  },
  {
    id: 'orin-bell', name: 'Orin Bell', title: 'Shrine Keeper', townId: 'oakmere', role: 'Lorekeeper who introduces myths, omens, and the deeper history of Mernodna', spriteFrame: 0, spriteTexture: 'npc_woman',
    worldOffset: { x: 120, y: -140 }, patrolRadius:32, weaponId: 'darkav-emberstaff',
    schedule: [{ startHour: 6, activity: 'Lights the road shrine' }, { startHour: 9, activity: 'Records travelers and omens' }, { startHour: 18, activity: 'Evening rites' }],
    relationshipToLeigneron: { kind: 'mystery', trust: 62, summary: 'Orin knows more about Leigneron’s inherited compass than he is willing to explain at the start.' },
    dialogue: ['Your compass is pointing again, is it not?', 'Do not assume a compass always points north. Some point toward unfinished stories.'],
    questIds: [],
  },
  {
    id: 'torren-ashfield', name: 'Torren Ashfield', title: 'Caravan Master', townId: 'oakmere', role: 'Merchant contact who connects Oakmere to distant towns and trade routes', spriteFrame: 0, spriteTexture:'npc_adventurer',
    worldOffset: { x: -280, y: 30 }, weaponId: 'roadwarden-sword', combatant: true,
    schedule: [{ startHour: 7, activity: 'Checks wagons' }, { startHour: 10, activity: 'Trades in the square' }, { startHour: 15, activity: 'Leaves on short caravan runs' }, { startHour: 20, activity: 'Returns to the inn when in town' }],
    relationshipToLeigneron: { kind: 'family-friend', trust: 65, summary: 'Torren knew Leigneron’s family through years of road trade and carries stories from across Mernodna.' },
    dialogue: ['Roads are honest, lad. It is people who lie about where they lead.', 'Clear the eastern route and I can start sending wagons toward Willowcross again.'],
    questIds: [],
  },
  {
    id: 'silas-crowe', name: 'Silas Crowe', title: 'Hunter', townId: 'oakmere', role: 'Friendly rival whose choices can push hunting and ecology systems in different directions', spriteFrame: 0, spriteTexture:'npc_adventurer',
    worldOffset: { x: 285, y: 15 }, weaponId: 'narenthil-longbow', combatant: true,
    schedule: [{ startHour: 4, activity: 'Leaves to hunt' }, { startHour: 14, activity: 'Returns with game' }, { startHour: 18, activity: 'Trades hides' }],
    relationshipToLeigneron: { kind: 'rival', trust: 50, summary: 'Silas and Leigneron compete constantly, but neither would leave the other bleeding on a road.' },
    dialogue: ['You took the easy trail again, did you?', 'The wolves are hungry because somebody scared the deer south. Kill every wolf you see and you will make a different problem.'],
    questIds: [],
  },
  {
    id: 'sena-marrow', name: 'Sena Marrow', title: 'Innkeeper', townId: 'oakmere', role: 'Rumor hub, local social anchor, and source of event leads', spriteFrame: 0, spriteTexture:'npc_attendant',
    worldOffset: { x: 85, y: 220 },
    schedule: [{ startHour: 6, activity: 'Prepares breakfast' }, { startHour: 9, activity: 'Runs the inn' }, { startHour: 19, activity: 'Serves travelers and gathers rumors' }, { startHour: 1, activity: 'Closes the common room' }],
    relationshipToLeigneron: { kind: 'ally', trust: 70, summary: 'Sena has watched Leigneron grow up and hears half the realm pass through her common room.' },
    dialogue: ['If you want news, sit where travelers loosen their belts and their tongues.', 'Someone from Willowcross arrived before dawn. No wagon. No horse. That usually means the road took the rest.'],
    questIds: [],
  },
  {
    id: 'nella-brook', name: 'Nella Brook', title: 'Oakmere Farmer', townId: 'oakmere', role: 'Farmer tending the southern fields and orchard edge', spriteFrame: 0, spriteTexture:'npc_villager',
    worldOffset: { x: -560, y: 350 },
    schedule: [{ startHour: 5, activity: 'Works the southern fields' }, { startHour: 11, activity: 'Rests by the orchard' }, { startHour: 16, activity: 'Carries produce to the inn' }, { startHour: 20, activity: 'Returns home' }],
    relationshipToLeigneron: { kind: 'acquaintance', trust: 50, summary: 'A practical farmer who has known Leigneron since childhood and keeps Oakmere fed.' },
    dialogue: ['The eastern road brings trouble as often as it brings trade.', 'Keep off the young rows, please. A boot can ruin a week of careful work.'],
    questIds: [],
  },
];

// Named Highmere residents give the crown, trade and craft wards separate
// social anchors. They use the same persistent, chunk-streamed NPC actors as
// Oakmere; each patrols around a believable workplace and returns home.
NPCS.push(
  { id:'captain-yselle-ward',name:'Yselle Ward',title:'Crown Gate Captain',townId:'highmere',role:'Commands the river bridge watch and assigns crown-road escorts',spriteFrame:0,spriteTexture:'npc_royal_guard',worldOffset:{x:-600,y:-480},weaponId:'oak-shield-blade',combatant:true,
    schedule:[{startHour:5,activity:'Reviews the west gate watch'},{startHour:9,activity:'Patrols Crown Way and the bridges'},{startHour:20,activity:'Returns to the barracks'}],
    relationshipToLeigneron:{kind:'authority',trust:38,summary:'Yselle knows Aldren by reputation and intends to judge his pupil by his deeds, not his surname.'},
    dialogue:['Aldren sent a pupil onto the eastern road? Then show me what he taught you.','The river has three crossings. Guard one and smugglers will test the other two.'],questIds:[] },
  { id:'renna-vale',name:'Renna Vale',title:'Crown Archivist',townId:'highmere',role:'Keeps road charters and the old royal survey of Trandum',spriteFrame:0,spriteTexture:'npc_attendant',worldOffset:{x:-560,y:-1030},
    schedule:[{startHour:7,activity:'Opens the Royal Archive'},{startHour:12,activity:'Reads petitions at Crown Hall'},{startHour:18,activity:'Visits the river shrine'}],
    relationshipToLeigneron:{kind:'family-friend',trust:61,summary:'Aldren’s cousin Renna has watched Leigneron’s journeys in the roadwarden ledgers since childhood.'},
    dialogue:['Aldren writes less than he should, but what he records matters.','The old survey marks paths that no tax map admits exist.'],questIds:[] },
  { id:'barric-thorne',name:'Barric Thorne',title:'Royal Quartermaster',townId:'highmere',role:'Supplies the crown patrols from the western barracks',spriteFrame:0,spriteTexture:'npc_general',worldOffset:{x:-1190,y:-515},weaponId:'roadwarden-sword',combatant:true,
    schedule:[{startHour:6,activity:'Counts stores at West Barracks'},{startHour:11,activity:'Inspects the crown stables'},{startHour:19,activity:'Drinks at Westgate Inn'}],
    relationshipToLeigneron:{kind:'acquaintance',trust:43,summary:'Barric once issued Aldren’s road gear and recognizes the repaired sword Leigneron carries.'},
    dialogue:['That hilt is older than you. Aldren kept it honest.','A patrol without water is a funeral with better boots.'],questIds:[] },
  { id:'maela-quill',name:'Maela Quill',title:'Market Speaker',townId:'highmere',role:'Represents the bridge merchants before the crown',spriteFrame:0,spriteTexture:'npc_villager',worldOffset:{x:1030,y:-560},
    schedule:[{startHour:6,activity:'Sets prices in Market Hall'},{startHour:13,activity:'Checks river customs'},{startHour:20,activity:'Closes her counting table'}],
    relationshipToLeigneron:{kind:'acquaintance',trust:48,summary:'Maela remembers Leigneron as the boy who helped Torren unload Oakmere grain wagons.'},
    dialogue:['A safe road is worth more than a royal decree saying it is safe.','Tell Torren I still expect that grain before the rains.'],questIds:[] },
  { id:'osric-flint',name:'Osric Flint',title:'Guild Master Smith',townId:'highmere',role:'Oversees forge contracts and repairs caravan ironwork',spriteFrame:0,spriteTexture:'npc_blacksmith',worldOffset:{x:1110,y:415},weaponId:'roadwarden-sword',combatant:true,
    schedule:[{startHour:5,activity:'Fires the Guild Forge'},{startHour:12,activity:'Inspects apprentice work'},{startHour:19,activity:'Walks the craft ward'}],
    relationshipToLeigneron:{kind:'acquaintance',trust:53,summary:'Joren Pike apprenticed under Osric and warned him that Leigneron is too hard on his blade.'},
    dialogue:['Joren taught you to sharpen from the heel, I hope.','A broken wagon axle can starve three villages. The forge serves more than soldiers.'],questIds:[] },
  { id:'tamsin-reed',name:'Tamsin Reed',title:'Westgate Innkeeper',townId:'highmere',role:'Shelters travelers and carries news between the crown and caravan yards',spriteFrame:0,spriteTexture:'npc_attendant',worldOffset:{x:-1390,y:55},
    schedule:[{startHour:5,activity:'Opens the Westgate common room'},{startHour:14,activity:'Buys produce at the market'},{startHour:21,activity:'Serves late road travelers'}],
    relationshipToLeigneron:{kind:'family-friend',trust:67,summary:'Tamsin trades recipes and road gossip with Sena Marrow, who asked her to keep an eye on Leigneron.'},
    dialogue:['Sena said you might turn up hungry. I put a pot on.','Soldiers hear orders. Innkeepers hear what happened afterward.'],questIds:[] },
  { id:'davin-bridge',name:'Davin Bridge',title:'River Customs Clerk',townId:'highmere',role:'Records cargo and bridge tolls for the market ward',spriteFrame:0,spriteTexture:'npc_adventurer',worldOffset:{x:850,y:-100},
    schedule:[{startHour:7,activity:'Checks morning bridge traffic'},{startHour:12,activity:'Walks to River Customs'},{startHour:18,activity:'Balances toll records'}],
    relationshipToLeigneron:{kind:'acquaintance',trust:44,summary:'Davin waved Leigneron through with Aldren’s wagon years ago and still remembers the unusual compass.'},
    dialogue:['Three bridges and one honest ledger. That is the theory, anyway.','If a caravan disappears, someone still has to explain the empty entry.'],questIds:[] },
  { id:'lina-farrow',name:'Lina Farrow',title:'South Ward Grower',townId:'highmere',role:'Carries vegetables from the city fringe to the market',spriteFrame:0,spriteTexture:'npc_villager',worldOffset:{x:-640,y:990},
    schedule:[{startHour:5,activity:'Tends the capital fields'},{startHour:11,activity:'Takes produce to South Market'},{startHour:19,activity:'Returns to the south homes'}],
    relationshipToLeigneron:{kind:'acquaintance',trust:57,summary:'Lina exchanges seed with Nella Brook in Oakmere and knows Leigneron from the harvest wagons.'},
    dialogue:['The crown eats because people out here wake before it does.','Nella says the Oakmere soil was kind this spring.'],questIds:[] },
);

const highmereResidents: Array<Pick<NpcDefinition,'id' | 'name' | 'title' | 'role' | 'worldOffset' | 'spriteTexture' | 'weaponId' | 'combatant' | 'patrolRadius'> & {
  work:string; social:string; trust:number; history:string; dialogueLines:[string,string];
}> = [
  { id:'sera-lorn',name:'Sera Lorn',title:'Crown Courier',role:'Carries sealed dispatches between the hall and bridge watch',worldOffset:{x:-630,y:110},spriteTexture:'npc_adventurer',weaponId:'roadwarden-sword',combatant:true,work:'Runs messages along Royal Way',social:'Shares supper with Yselle’s watch',trust:52,history:'Sera once raced Leigneron along the Oakmere road and still calls him slow when she sees him.',dialogueLines:['Letters ride faster when the carrier knows every back lane.','Yselle can wait for her seal. The river cannot wait for its bridge.'] },
  { id:'garron-holt',name:'Garron Holt',title:'Crown Way Sentinel',role:'Keeps pedestrians and carts apart at the busy western junction',worldOffset:{x:-880,y:70},spriteTexture:'npc_royal_guard',weaponId:'oak-shield-blade',combatant:true,work:'Directs crown-road traffic',social:'Reports to Captain Yselle',trust:40,history:'Garron checked Aldren’s papers on Leigneron’s first visit to the capital and has not forgotten the boy’s questions.',dialogueLines:['Keep the carts on the right and the sword in its sheath.','The bridge is busy enough without a duel in the middle.'] },
  { id:'maren-voss',name:'Maren Voss',title:'Crown Shrine Acolyte',role:'Tends candles and travelers at the southern crown shrine',worldOffset:{x:-180,y:350},patrolRadius:32,spriteTexture:'npc_woman',weaponId:'darkav-emberstaff',work:'Tends the shrine lamps',social:'Copies omens for Renna’s archive',trust:55,history:'Maren is Elara Voss’s sister and recognizes Leigneron from Oakmere shrine visits.',dialogueLines:['Elara says you have a habit of arriving where trouble starts.','A candle is not protection, but it reminds travelers who waits for them.'] },
  { id:'eddan-ford',name:'Eddan Ford',title:'River Warden',role:'Inspects the western bridge pilings and reports floods',worldOffset:{x:130,y:90},spriteTexture:'npc_general',weaponId:'roadwarden-sword',combatant:true,work:'Walks the west bridge approaches',social:'Trades flood notes with Davin',trust:46,history:'Eddan helped pull Leigneron and Torren’s cart from a flooded ford years ago.',dialogueLines:['The river takes a careless wheel quicker than any bandit.','Those pilings need another inspection before the rain.'] },
  { id:'faye-merrow',name:'Faye Merrow',title:'Bridge Fishmonger',role:'Sells fresh river catch to both halves of Highmere',worldOffset:{x:720,y:70},spriteTexture:'npc_villager',work:'Sets out fish at the east bridge',social:'Barters with Maela in Market Hall',trust:58,history:'Faye buys smoked herbs from Mira Fen and once gave Leigneron a meal when his purse was empty.',dialogueLines:['Fresh catch! Unless you came after the noon bell.','Maela knows the price of every fish but has never held a net.'] },
  { id:'halden-pike',name:'Halden Pike',title:'Caravan Broker',role:'Matches road escorts with merchants and freight',worldOffset:{x:1030,y:-75},spriteTexture:'npc_attendant',work:'Keeps contracts at River Customs',social:'Visits cousin Joren when Oakmere wagons arrive',trust:60,history:'Halden is Joren Pike’s cousin and knew Leigneron through the smithy before he knew the crown market.',dialogueLines:['Joren says your sword survives despite its owner.','A good escort is cheaper than an empty wagon.'] },
  { id:'kael-rusk',name:'Kael Rusk',title:'Forge Apprentice',role:'Carries finished fittings from the guild forge to caravan stores',worldOffset:{x:840,y:760},spriteTexture:'npc_blacksmith',weaponId:'roadwarden-sword',work:'Runs errands for Osric Flint',social:'Practices blade forms with the bridge guards',trust:47,history:'Kael admires Leigneron’s roadwarden sword and has asked Joren for its old repair notes.',dialogueLines:['Master Osric says the rivet matters more than the shine.','Let me see the edge when you return from the road.'] },
  { id:'tilda-brook',name:'Tilda Brook',title:'South Market Carrier',role:'Moves field produce through the south causeway',worldOffset:{x:-610,y:790},spriteTexture:'npc_villager',work:'Carries baskets into South Market',social:'Helps Lina Farrow at the field stalls',trust:63,history:'Tilda is Nella Brook’s aunt and has known Leigneron since his family bought their winter stores from her.',dialogueLines:['Walk with purpose or the whole market will walk around you.','Nella sends the best onions north, if the road stays open.'] },
];
NPCS.push(...highmereResidents.map(({ work,social,trust,history,dialogueLines,...identity }) => ({
  ...identity,townId:'highmere',spriteFrame:0,
  schedule:[{ startHour:6,activity:work },{ startHour:12,activity:social },{ startHour:20,activity:'Returns to the home ward' }],
  relationshipToLeigneron:{ kind:'acquaintance' as const,trust,summary:history },dialogue:dialogueLines,questIds:[],
})));

const regionalResidents: Array<{
  townId:string; id:string; name:string; title:string; role:string; spriteTexture:NpcDefinition['spriteTexture'];
  worldOffset:{x:number;y:number}; work:string; social:string; trust:number; history:string; dialogueLines:[string,string];
}> = [
  { townId:'willowcross',id:'willowcross-keeper',name:'Pella Reed',title:'Bridge Keeper',role:'Maintains the bridge spans and guides travelers onto the eastern road',spriteTexture:'npc_villager',worldOffset:{x:-130,y:-430},work:'Inspects the west bridge',social:'Shares route reports at the stable',trust:48,history:'Pella remembers Leigneron as the quiet child who asked how every bridge was built.',dialogueLines:['The bridge is sound. The road beyond it is another matter.','Narenthil’s pines are swallowing the old milestones.'] },
  { townId:'willowcross',id:'willowcross-fletcher',name:'Tovan Marr',title:'Road Fletcher',role:'Makes arrows and repairs the stable’s traveling bows',spriteTexture:'npc_adventurer',worldOffset:{x:130,y:430},work:'Fletches arrows by the south road',social:'Trades with the bridge patrol',trust:44,history:'Tovan once supplied Mira Fen with her first field arrows.',dialogueLines:['Straight shafts fly true; crooked roads rarely do.','If you see Mira, tell her I still have the yew bow she asked for.'] },
  { townId:'elarion',id:'elarion-lorekeeper',name:'Ilyra Thorneleaf',title:'Lorekeeper of the Boughs',role:'Studies the old forest wards and records changes in the living city',spriteTexture:'npc_woman',worldOffset:{x:-130,y:-430},work:'Reads ward-stones in the lower grove',social:'Compares notes with the bowyers',trust:50,history:'Ilyra recognizes Aldren’s old roadwarden mark from the archives.',dialogueLines:['The city remembers every root that was cut to build it.','A pale light has moved beneath the moon grove. It is not a lantern.'] },
  { townId:'elarion',id:'elarion-bowyer',name:'Sael Virdan',title:'Whitebough Bowyer',role:'Builds longbows from fallen branches and trains the outer sentries',spriteTexture:'npc_huntress',worldOffset:{x:130,y:430},work:'Works the eastern bowyard',social:'Walks the bough-bridge watch',trust:42,history:'Sael traded arrowheads with Mira during her first trip into Narenthil.',dialogueLines:['Never take living wood for a weapon. The forest keeps count.','Something has made the wolves bold enough to cross the silver river.'] },
  { townId:'moonfall',id:'moonfall-herbalist',name:'Neris Vale',title:'Grove Herbalist',role:'Tends moonlit healing plants and studies the grove’s growing blight',spriteTexture:'npc_woman',worldOffset:{x:-130,y:-420},work:'Gathers dew herbs before sunrise',social:'Shares remedies at the standing stones',trust:46,history:'Neris once treated Aldren after a winter patrol through the grove.',dialogueLines:['The leaves curl before the frost comes. Something is poisoning their roots.','Do not follow the blue lights after moonrise.'] },
  { townId:'moonfall',id:'moonfall-ranger',name:'Eren Mosswalk',title:'Standing-Stone Ranger',role:'Guards the grove paths and keeps watch for the Moonlit Warden',spriteTexture:'npc_huntress',worldOffset:{x:130,y:420},work:'Patrols the north stones',social:'Repairs trail markers with Neris',trust:53,history:'Eren guided Leigneron’s parents through Narenthil on a pilgrimage years ago.',dialogueLines:['I saw a figure between the stones. It moved against the wind.','If you face it, keep moving. The grove itself seems to answer its call.'] },
  { townId:'starhold',id:'starhold-quartermaster',name:'Borin Skell',title:'Pass Quartermaster',role:'Keeps the citadel’s climbing gear, provisions, and avalanche stores',spriteTexture:'npc_general',worldOffset:{x:-130,y:-470},work:'Checks the north-pass stores',social:'Counts caravan supplies with the mountaineers',trust:49,history:'Borin has bought ironwork from Joren Pike since both were apprentices.',dialogueLines:['The pass does not care how brave you are. Bring rope.','Stonejaw has been breaking the lower wagons again.'] },
  { townId:'starhold',id:'starhold-templar',name:'Sister Halla',title:'Beacon Templar',role:'Tends the mountain shrine and signals safe passage through the snow',spriteTexture:'npc_guard',worldOffset:{x:130,y:470},work:'Lights the western beacon',social:'Prays with the pass-watch',trust:57,history:'Halla once carried medicine from Oakmere to the Starhold infirmary.',dialogueLines:['The beacon is lit, but the pass still feels watched.','Stonejaw’s blows shake snow from the high ledges. Do not stand beneath them.'] },
  { townId:'redmesa',id:'redmesa-beastmaster',name:'Ugra Flintmane',title:'Clan Beastmaster',role:'Tends the clan mounts and trains riders to control their war-boars',spriteTexture:'npc_general',worldOffset:{x:-130,y:-470},work:'Feeds the east pens',social:'Runs the young riders through drills',trust:45,history:'Ugra respects Aldren’s discipline and says it reminds her of an old clan mentor.',dialogueLines:['A boar charges when cornered. Krag charges because he likes the sound.','The chieftain has turned the clans against one another.'] },
  { townId:'redmesa',id:'redmesa-forgewright',name:'Dorga Ashhand',title:'Red Mesa Forgewright',role:'Forges clan tools and negotiates ore for the stronghold',spriteTexture:'npc_blacksmith',worldOffset:{x:130,y:470},work:'Works the south forge',social:'Barters iron with the market camp',trust:51,history:'Dorga once repaired Leigneron’s family cart during a trade-season storm.',dialogueLines:['A blade can be mended. A clan split by fear takes longer.','Krag wears iron tusks and thinks that makes him unbreakable.'] },
  { townId:'deepford',id:'deepford-boatwright',name:'Thrain Copperwake',title:'River Boatwright',role:'Builds ferries and maintains the river crossings around Deepford',spriteTexture:'npc_blacksmith',worldOffset:{x:-130,y:-470},work:'Repairs the upper ferry',social:'Swaps river charts with the mine guild',trust:47,history:'Thrain once ferried Torren Ashfield through a flood when the road bridges failed.',dialogueLines:['The river runs under the roots and past the old mine mouths.','We hear knocking below the lower hall. It answers when the hammers stop.'] },
  { townId:'deepford',id:'deepford-runesmith',name:'Mara Stonevein',title:'Runesmith',role:'Reads old ward marks and inscribes protective runes for the river-hall',spriteTexture:'npc_general',worldOffset:{x:130,y:470},work:'Studies ward-stones in the east hall',social:'Teaches apprentices at the guild forge',trust:56,history:'Mara knew Leigneron’s mother from a relief caravan that brought supplies to Druganwoods.',dialogueLines:['Those are not dwarven runes. They are much older than the hall.','The Rootfather is a name the miners stopped saying aloud.'] },
  { townId:'tidewatch',id:'tidewatch-harbor-master',name:'Jessa Gull',title:'Harbor Master',role:'Assigns berths and keeps smuggling crews from taking over the quay',spriteTexture:'npc_general',worldOffset:{x:-130,y:-430},work:'Checks the outer quay',social:'Reviews cargo ledgers with the harbor guild',trust:49,history:'Jessa once arranged safe passage for a medicine ship bound for Oakmere.',dialogueLines:['The eastern channel is open, but the Salt King charges for every sail.','Do not trust a quiet harbor when his colors are nearby.'] },
  { townId:'tidewatch',id:'tidewatch-sailmaker',name:'Orren Vane',title:'Sailmaker',role:'Repairs storm-torn sails and helps crews navigate Portquill’s shoals',spriteTexture:'npc_adventurer',worldOffset:{x:130,y:430},work:'Mends canvas near the shipyard',social:'Shares sea charts at the inn',trust:43,history:'Orren once sold Mira Fen a weatherproof cloak for one copper and a promise.',dialogueLines:['Canvas tells the truth about a storm before the sky does.','The Salt King has chained the northern beacon to his own signal.'] },
  { townId:'skallheim',id:'skallheim-hunter',name:'Runa Icevein',title:'Beacon Hunter',role:'Tracks predators near the harbor and keeps the beacon approach clear',spriteTexture:'npc_huntress',worldOffset:{x:-130,y:-430},work:'Checks snares beyond the snow berm',social:'Shares tracks with the longhouse hunters',trust:52,history:'Runa once guided an Oakmere caravan through a blizzard without losing a single cart.',dialogueLines:['The tracks are too large for any wolf I know.','The beacon keeps the harbor alive. If it goes dark, the ice takes the road.'] },
  { townId:'skallheim',id:'skallheim-trader',name:'Eyvind Harrow',title:'Longhouse Trader',role:'Trades fish, furs, and iron tools between the frost clans',spriteTexture:'npc_villager',worldOffset:{x:130,y:430},work:'Weighs fish at the south quay',social:'Shares a meal with the longhouse watch',trust:45,history:'Eyvind has carried Aldren’s roadwarden letters to the far eastern clans.',dialogueLines:['The Wyrm came down from the ice cliff and the reindeer scattered.','Bring a warm cloak. The wind cuts through mail as if it were linen.'] },
  { townId:'blackspire',id:'blackspire-forgemaster',name:'Vexa Cinder',title:'Citadel Forgemaster',role:'Maintains the volcanic forges and the chains beneath the citadel',spriteTexture:'npc_blacksmith',worldOffset:{x:-130,y:-470},work:'Tends the west furnace',social:'Checks the chainworks with the dock crews',trust:42,history:'Vexa once refused a crown contract rather than forge weapons for a village raid.',dialogueLines:['The mountain breathes hotter when the old wards weaken.','The Seer sends wraiths to the roads so no one can reach the citadel.'] },
  { townId:'blackspire',id:'blackspire-warder',name:'Dain Emberfall',title:'Ash Road Warder',role:'Keeps the ash-road signs visible and watches for cult patrols',spriteTexture:'npc_guard',worldOffset:{x:130,y:470},work:'Patrols the lower ash road',social:'Reports cult movement to the gate watch',trust:50,history:'Dain knows Aldren’s reputation from the old border patrols and trusts his judgment.',dialogueLines:['The ash hides footprints, but not the heat they leave behind.','The Ashen Seer is waiting beyond the broken road. Do not let the summons surround you.'] },
];
NPCS.push(...regionalResidents.map(({ work,social,trust,history,dialogueLines,...identity }) => ({
  ...identity,spriteFrame:0,
  schedule:[{ startHour:6,activity:work },{ startHour:12,activity:social },{ startHour:20,activity:'Returns to the home ward' }],
  relationshipToLeigneron:{ kind:'acquaintance' as const,trust,summary:history },dialogue:dialogueLines,questIds:[],
})));

NPCS.push(...CAPITAL_RESIDENTS,...REGIONAL_WORKERS,...CIBAR_RESIDENTS,...WARD_RESIDENTS,...ROAD_RESIDENTS);
for(const [id,name,x,y] of [
  ['elarion-north-sentinel','Thalanor Vael',0,-1140],
  ['elarion-west-sentinel','Eryndor Silverbough',-1220,-40],
  ['elarion-east-sentinel','Caladwen Starleaf',1220,-40],
  ['elarion-south-sentinel','Aelion Greenmantle',0,1080],
] as const)NPCS.push({id,name,title:'Whitebough Sentinel',townId:'elarion',
  role:'Patrols the living city and keeps the forest approaches safe',spriteTexture:'npc_elven_guard_idle',spriteFrame:0,
  worldOffset:{x,y},homeLocation:{x,y},patrolRadius:96,combatant:true,weaponId:'narenthil-longbow',faction:'Whitebough Watch',
  relationshipToLeigneron:{kind:'acquaintance',trust:48,summary:'A vigilant sentinel of Elarion’s living wards'},
  schedule:[{startHour:6,activity:'Patrols the city approach',location:{x,y}},{startHour:18,activity:'Keeps the evening watch',location:{x,y}}],
  dialogue:['The boughs shelter those who respect them. Keep to the marked paths.','The ward is quiet for now, but the forest paths are never unwatched.'],questIds:[]});
for(const [id,name,x] of [
  ['elarion-hall-guard-west','Lethariel Dawnwatch',-840],
  ['elarion-hall-guard-east','Caelith Moonward',-560],
] as const)NPCS.push({id,name,title:'Whitebough Hall Guard',townId:'elarion',
  role:'Stands watch in the entrance gallery of Whitebough Hall',spriteTexture:'npc_elven_guard_idle',spriteFrame:0,
  worldOffset:{x,y:-650},homeLocation:{x,y:-650},patrolRadius:0,stationary:true,combatant:true,
  weaponId:'narenthil-longbow',faction:'Whitebough Watch',
  relationshipToLeigneron:{kind:'acquaintance',trust:48,summary:'A steadfast guard of Whitebough Hall'},
  schedule:[{startHour:0,activity:'Stands watch in the Whitebough entrance gallery',location:{x,y:-650}}],
  dialogue:['Whitebough Hall is under the watch of the sentinels.','The hall stands for every bough and home in Elarion.'],questIds:[]});
NPCS.push({id:'elarion-king',name:'Elarion King',title:'King of the Elves',townId:'elarion',
  role:'Rules Elarion and receives visitors at Whitebough Hall',spriteTexture:'npc_elven_king_idle',spriteFrame:0,
  worldOffset:{x:-700,y:-650},homeLocation:{x:-700,y:-650},stationary:true,
  relationshipToLeigneron:{kind:'acquaintance',trust:60,summary:'The reigning king of Elarion'},
  schedule:[{startHour:0,activity:'Receives visitors at Whitebough Hall',location:{x:-700,y:-650}}],
  dialogue:['Welcome to Whitebough Hall. The boughs of Elarion remember every guest.','Speak freely; the safety of our people is the first duty of the crown.'],questIds:[]});
for(const [id,name,x,history] of [
  ['ser-elin-ward','Elin Ward',-1110,'Yselle’s younger sister; remembers Aldren bringing Leigneron to the royal oath ceremony'],
  ['ser-tomas-rowe','Tomas Rowe',-890,'Caldus’s son; exchanged practice swords with Leigneron as a child'],
] as const) NPCS.push({id,name,title:'Royal Audience Sentinel',townId:'highmere',role:'Protects the joined south-facing royal gate and keeps its approach open',
  spriteTexture:'npc_royal_guard',spriteFrame:0,worldOffset:{x,y:-1190},patrolRadius:24,combatant:true,weaponId:'oak-shield-blade',
  faction:'Royal Guard',family:history,connections:[{npcId:'captain-yselle-ward',relationship:'Commanding officer'}],
  relationshipToLeigneron:{kind:'acquaintance',trust:48,summary:history},homeLocation:{x,y:-1190},
  schedule:[{startHour:6,activity:'Guards the audience entrance',location:{x,y:-1190}},{startHour:20,activity:'Keeps the evening audience watch',location:{x,y:-1190}}],
  dialogue:['The audience road stays open. Petitioners enter through the arch, not through the gardens.','Adria hears signed petitions on the castle steps.'],questIds:[],dialoguePersonality:'Courteous and vigilant'});
for(const [id,name,x,y,history] of [
  ['annor-lorn','Annor Lorn',1280,-2610,'Sera Lorn’s uncle; taught Leigneron and Sera how to pack a road satchel'],
  ['hestia-farrow','Hestia Farrow',-720,2590,'Lina Farrow’s sister; helped Aldren distribute the winter grain relief'],
] as const)NPCS.push({id,name,title:'Highmere Gate Sentinel',townId:'highmere',role:'Keeps the outer gate approach clear and checks incoming relief wagons',spriteTexture:'npc_royal_guard',spriteFrame:0,
  worldOffset:{x,y},homeLocation:{x,y},patrolRadius:40,combatant:true,weaponId:'oak-shield-blade',faction:'Royal Guard',family:history,
  connections:[{npcId:'captain-yselle-ward',relationship:'Commanding officer'}],dialoguePersonality:'Alert, practical, welcoming to honest travelers',
  schedule:[{startHour:6,activity:'Inspects the gate approach',location:{x,y}},{startHour:20,activity:'Keeps the lantern watch',location:{x,y}}],
  relationshipToLeigneron:{kind:'acquaintance',trust:55,summary:history},dialogue:['The arch is open. Keep wagons to the marked road so the watch can see their cargo.','The city keeps a public relief tally now. Bring the kitchens their promised grain.'],questIds:[]});
for(const npc of NPCS) {
  if(npc.id==='mairin-reed') npc.questIds=['shadows-highmere'];
  if(npc.id==='captain-yselle-ward') npc.questIds=['royal-guard-trial'];
  if(npc.id==='renna-vale') npc.questIds=['kingdom-divided'];
  // Turn the old descriptive timetable into nearby physical work/social/rest
  // anchors. Long-distance routines are explicitly authored below.
  npc.homeLocation??={...npc.worldOffset};
  npc.schedule=npc.schedule.map((period,i)=>({...period,location:period.location??{
    x:npc.worldOffset.x+(i%2?24:0),y:npc.worldOffset.y+(i%2?40:0),
  }}));
}
const capitalRoutines:Record<string,Array<{x:number;y:number}>>={
  'renna-vale':[{x:-560,y:-1030},{x:-1110,y:-1550},{x:-180,y:350}],
  'captain-yselle-ward':[{x:-600,y:-480},{x:-900,y:40},{x:-600,y:-480}],
  'maela-quill':[{x:1030,y:-560},{x:1030,y:-75},{x:1030,y:-560}],
  'barric-thorne':[{x:-1190,y:-515},{x:-950,y:-120},{x:-1390,y:55}],
  'lina-farrow':[{x:-640,y:990},{x:-580,y:1490},{x:-640,y:990}],
  'tamsin-reed':[{x:-1390,y:55},{x:-120,y:90},{x:-1390,y:55}],
};
for(const npc of NPCS) if(capitalRoutines[npc.id])npc.schedule=npc.schedule.map((p,i)=>({...p,location:capitalRoutines[npc.id][i]}));
for(const npc of NPCS)if(['blackspire-forgemaster','blackspire-warder'].includes(npc.id)){
  npc.questIds.push('returning-ember');
  npc.dialogue.push(npc.id==='blackspire-forgemaster'?'The old ward chains buy shelter, not the death of a dragon. Varkhul always returns to the molten shelf.'
    :'The dragon’s western ash trail runs outside our defenses. Keep challengers there, away from the furnace households.');
}
for(const npc of NPCS.filter(resident=>resident.townId==='elarion')){
  if(npc.spriteTexture==='npc_elven_king_idle'){
    npc.stationary=true;
  }else if(npc.spriteTexture==='npc_elven_guard_idle'){
    npc.patrolRadius??=96;
  }else if(npc.spriteTexture==='npc_guard'||npc.spriteTexture==='npc_royal_guard'){
    npc.spriteTexture='npc_elven_guard_idle';npc.patrolRadius??=96;
  }else if(npc.spriteTexture!=='npc_huntress'||npc.id==='elarion-bowyer'){
    const maleHouseholdResident=['aerin-virdan','talan-virdan'].includes(npc.id);
    npc.spriteTexture=maleHouseholdResident||npc.spriteTexture==='npc_blacksmith'||npc.spriteTexture==='npc_adventurer'
      ||npc.spriteTexture==='npc_general'||npc.id==='elarion-bowyer'?'npc_elven_man_idle':'npc_elven_woman_idle';
  }
}
// Edmund Atwood is the existing mentor (legacy content ID must remain stable).
// Do not spawn a second Edmund or rename his persisted NPC ID.
export const EDMUND_ATWOOD_ID='aldren-vale';
export const NPC_NAME_ALIASES = prepareNpcPresentation(NPCS);
// Authored household identities retain their dialogue and do not consume the
// legacy name palette or change any approved citizen's display-name allocation.
NPCS.push(...CASTLE_RESIDENTS);
// Append after legacy presentation so approved identities/models are untouched,
// and human visitors to Elarion bypass its native-only model conversion.
NPCS.push(...createSettlementResidents(NPCS));
NPCS.push(...createHighmereResidents());
NPCS.push(...STORY_RESIDENTS);
reviseNamedConversations(NPCS,NPC_NAME_ALIASES);
for(const npc of NPCS)npc.questIds.push(...(ADVENTURE_QUEST_GIVERS[npc.id]??[]));
for(const npc of NPCS){const p=npc.townId==='highmere'?HIGHMERE_SENTRY_ANCHORS[npc.id]:undefined;if(!p)continue;
  npc.worldOffset={...p};npc.homeLocation={...p};npc.stationary=true;npc.patrolRadius=0;
  npc.schedule=npc.schedule.map(period=>({...period,location:{...p}}));
}
for(const npc of NPCS){const p=npc.townId==='highmere'?CAPITAL_NPC_COURTS[npc.id]:undefined;if(!p)continue;
  npc.worldOffset={...p};npc.homeLocation={...p};npc.patrolRadius=0;
  npc.schedule=npc.schedule.map(period=>({...period,location:{...p}}));
}
export const NPC_BY_ID = Object.fromEntries(NPCS.map((npc) => [npc.id, npc])) as Record<string, NpcDefinition>;

/** Content-dependent street roles are admitted only after their actual stall
 * and standing space have survived the fixed city placement passes. */
export function registerHighmereStreetNpc(npc:NpcDefinition){
 if(npc.townId!=='highmere'||!npc.id.startsWith('capital:highmere:street:'))throw new Error('Invalid capital street resident');
 if(NPC_BY_ID[npc.id])return NPC_BY_ID[npc.id];
 NPCS.push(npc);NPC_BY_ID[npc.id]=npc;return npc;
}
