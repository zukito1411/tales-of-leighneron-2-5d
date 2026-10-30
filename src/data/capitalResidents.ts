import {HIGHMERE_MARCH_ROUTE,HIGHMERE_MARCH_SPACING,HIGHMERE_MARCH_STATIONS} from './highmerePlan';
import type { NpcDefinition } from '../game/types';

// Named residents, not anonymous quest-critical filler. Coordinates are local
// authored activity anchors; the street router supplies physical travel.
export const CAPITAL_RESIDENTS:NpcDefinition[] = [
  {
    "id": "mairin-reed",
    "name": "Mairin Reed",
    "title": "Lower Ward Kitchen Keeper",
    "spriteTexture": "npc_attendant",
    "townId": "highmere",
    "spriteFrame": 0,
    "worldOffset": {
      "x": -1360,
      "y": 1585
    },
    "role": "Organizes meals and searches for missing dockworkers",
    "family": "Tamsin Reed is her sister; their kitchens exchange flour",
    "faction": "Highmere Households",
    "connections": [
      {
        "npcId": "davin-bridge",
        "relationship": "Personal connection described in family and history"
      },
      {
        "npcId": "tamsin-reed",
        "relationship": "Personal connection described in family and history"
      }
    ],
    "dialoguePersonality": "Plain-spoken, protective and impatient with charity without action",
    "homeLocation": {
      "x": -1360,
      "y": 1585
    },
    "schedule": [
      {
        "startHour": 6,
        "activity": "Organizes meals and searches for missing dockworkers",
        "location": {
          "x": -1360,
          "y": 1585
        }
      },
      {
        "startHour": 18,
        "activity": "Meets neighbors outside the workplace",
        "location": {
          "x": -1336,
          "y": 1625
        }
      },
      {
        "startHour": 22,
        "activity": "Rests at home",
        "location": {
          "x": -1360,
          "y": 1585
        }
      }
    ],
    "relationshipToLeigneron": {
      "kind": "acquaintance",
      "trust": 55,
      "summary": "Sena sent Leigneron to her kitchen when his family brought winter grain"
    },
    "dialogue": [
      "Tamsin Reed is her sister; their kitchens exchange flour.",
      "Organizes meals and searches for missing dockworkers. The city cannot live on decrees alone."
    ],
    "questIds": [],
    "patrolRadius": 48,
    "combatant": false,
    "storyConsequences": [
      "Responds to the grain inquiry and its chosen political outcome"
    ]
  },
  {
    "id": "tovin-reed",
    "name": "Tovin Reed",
    "title": "Missing Dockworker",
    "spriteTexture": "npc_adventurer",
    "townId": "highmere",
    "spriteFrame": 0,
    "worldOffset": {
      "x": -2040,
      "y": 2140
    },
    "role": "Witness to the forged grain receipts, hiding by the old weighhouse",
    "family": "Mairin is his mother; Pell is his childhood friend",
    "faction": "Highmere Households",
    "connections": [
      {
        "npcId": "mairin-reed",
        "relationship": "Personal connection described in family and history"
      },
      {
        "npcId": "pell-rusk",
        "relationship": "Personal connection described in family and history"
      }
    ],
    "dialoguePersonality": "Frightened but precise about cargo marks",
    "homeLocation": {
      "x": -2040,
      "y": 2140
    },
    "schedule": [
      {
        "startHour": 6,
        "activity": "Witness to the forged grain receipts, hiding by the old weighhouse",
        "location": {
          "x": -2040,
          "y": 2140
        }
      },
      {
        "startHour": 18,
        "activity": "Meets neighbors outside the workplace",
        "location": {
          "x": -2016,
          "y": 2180
        }
      },
      {
        "startHour": 22,
        "activity": "Rests at home",
        "location": {
          "x": -2040,
          "y": 2140
        }
      }
    ],
    "relationshipToLeigneron": {
      "kind": "acquaintance",
      "trust": 55,
      "summary": "Helped Leigneron lift Torren’s overturned cargo on an earlier capital visit"
    },
    "dialogue": [
      "Mairin is his mother; Pell is his childhood friend.",
      "Witness to the forged grain receipts, hiding by the old weighhouse. The city cannot live on decrees alone."
    ],
    "questIds": [],
    "patrolRadius": 48,
    "combatant": false,
    "storyConsequences": [
      "Responds to the grain inquiry and its chosen political outcome"
    ]
  },
  {
    "id": "pell-rusk",
    "name": "Pell Rusk",
    "title": "Lower Ward Runner",
    "spriteTexture": "npc_adventurer",
    "townId": "highmere",
    "spriteFrame": 0,
    "worldOffset": {
      "x": -2080,
      "y": 1760
    },
    "role": "Guides couriers through worker lanes and knows the secret receiving yard",
    "family": "Kael is his older brother; Tovin is his closest friend",
    "faction": "Highmere Households",
    "connections": [
      {
        "npcId": "tovin-reed",
        "relationship": "Personal connection described in family and history"
      },
      {
        "npcId": "kael-rusk",
        "relationship": "Personal connection described in family and history"
      }
    ],
    "dialoguePersonality": "Wry and wary of uniforms",
    "homeLocation": {
      "x": -2080,
      "y": 1760
    },
    "schedule": [
      {
        "startHour": 6,
        "activity": "Guides couriers through worker lanes and knows the secret receiving yard",
        "location": {
          "x": -2080,
          "y": 1760
        }
      },
      {
        "startHour": 18,
        "activity": "Meets neighbors outside the workplace",
        "location": {
          "x": -2056,
          "y": 1800
        }
      },
      {
        "startHour": 22,
        "activity": "Rests at home",
        "location": {
          "x": -2080,
          "y": 1760
        }
      }
    ],
    "relationshipToLeigneron": {
      "kind": "acquaintance",
      "trust": 55,
      "summary": "Remembers losing a footrace to Leigneron and Sera at the river"
    },
    "dialogue": [
      "Kael is his older brother; Tovin is his closest friend.",
      "Guides couriers through worker lanes and knows the secret receiving yard. The city cannot live on decrees alone."
    ],
    "questIds": [],
    "patrolRadius": 48,
    "combatant": false,
    "storyConsequences": [
      "Responds to the grain inquiry and its chosen political outcome"
    ]
  },
  {
    "id": "sevrin-hale",
    "name": "Sevrin Hale",
    "title": "Deputy Grain Comptroller",
    "spriteTexture": "npc_general",
    "townId": "highmere",
    "spriteFrame": 0,
    "worldOffset": {
      "x": 1800,
      "y": -510
    },
    "role": "Controls grain permits and concealed unauthorized requisitions",
    "family": "No surviving local family; patron to a small clerk circle",
    "faction": "Grain Office",
    "connections": [
      {
        "npcId": "davin-bridge",
        "relationship": "Personal connection described in family and history"
      },
      {
        "npcId": "maela-quill",
        "relationship": "Personal connection described in family and history"
      }
    ],
    "dialoguePersonality": "Polished, evasive, contempt concealed behind procedure",
    "homeLocation": {
      "x": 1800,
      "y": -510
    },
    "schedule": [
      {
        "startHour": 6,
        "activity": "Controls grain permits and concealed unauthorized requisitions",
        "location": {
          "x": 1800,
          "y": -510
        }
      },
      {
        "startHour": 18,
        "activity": "Meets neighbors outside the workplace",
        "location": {
          "x": 1824,
          "y": -470
        }
      },
      {
        "startHour": 22,
        "activity": "Rests at home",
        "location": {
          "x": 1800,
          "y": -510
        }
      }
    ],
    "relationshipToLeigneron": {
      "kind": "acquaintance",
      "trust": 20,
      "summary": "Signed Aldren’s old travel permits and expects his pupil to obey seals"
    },
    "dialogue": [
      "No surviving local family; patron to a small clerk circle.",
      "A stamped receipt is the end of the matter. Unless someone has been careless."
    ],
    "questIds": [],
    "patrolRadius": 48,
    "combatant": false,
    "storyConsequences": [
      "Responds to the grain inquiry and its chosen political outcome"
    ]
  },
  {
    "id": "lady-adria-vale",
    "name": "Adria Vale",
    "title": "Royal Petitions Steward",
    "spriteTexture": "npc_attendant",
    "townId": "highmere",
    "spriteFrame": 0,
    "worldOffset": {
      "x": -1150,
      "y": -1620
    },
    "role": "Chairs public audiences and can enforce relief reforms",
    "family": "Renna’s elder sister and Aldren’s cousin",
    "faction": "Crown Petitions",
    "connections": [
      {
        "npcId": "renna-vale",
        "relationship": "Personal connection described in family and history"
      },
      {
        "npcId": "captain-yselle-ward",
        "relationship": "Personal connection described in family and history"
      }
    ],
    "dialoguePersonality": "Formal but listens closely to evidence",
    "homeLocation": {
      "x": -1150,
      "y": -1620
    },
    "schedule": [
      {
        "startHour": 6,
        "activity": "Chairs public audiences and can enforce relief reforms",
        "location": {
          "x": -1150,
          "y": -1620
        }
      },
      {
        "startHour": 18,
        "activity": "Meets neighbors outside the workplace",
        "location": {
          "x": -1126,
          "y": -1580
        }
      },
      {
        "startHour": 22,
        "activity": "Rests at home",
        "location": {
          "x": -1150,
          "y": -1620
        }
      }
    ],
    "relationshipToLeigneron": {
      "kind": "acquaintance",
      "trust": 55,
      "summary": "Knew Leigneron as the child who asked why the palace had more chimneys than Oakmere"
    },
    "dialogue": [
      "Renna’s elder sister and Aldren’s cousin.",
      "Chairs public audiences and can enforce relief reforms. The city cannot live on decrees alone."
    ],
    "questIds": [],
    "patrolRadius": 48,
    "combatant": false,
    "storyConsequences": [
      "Responds to the grain inquiry and its chosen political outcome"
    ]
  },
  {
    "id": "ser-caldus-rowe",
    "name": "Caldus Rowe",
    "title": "Royal Drill Instructor",
    "spriteTexture": "npc_royal_guard",
    "townId": "highmere",
    "spriteFrame": 0,
    "worldOffset": {
      "x": -1820,
      "y": -400
    },
    "role": "Teaches controlled swordwork and maintains the drill ground",
    "family": "Mentored Yselle; his family tends the western military gardens",
    "faction": "Royal Guard",
    "connections": [
      {
        "npcId": "captain-yselle-ward",
        "relationship": "Personal connection described in family and history"
      },
      {
        "npcId": "barric-thorne",
        "relationship": "Personal connection described in family and history"
      }
    ],
    "dialoguePersonality": "Patient, clipped commands and dry humor",
    "homeLocation": {
      "x": -1820,
      "y": -400
    },
    "schedule": [
      {
        "startHour": 6,
        "activity": "Teaches controlled swordwork and maintains the drill ground",
        "location": {
          "x": -1820,
          "y": -400
        }
      },
      {
        "startHour": 18,
        "activity": "Meets neighbors outside the workplace",
        "location": {
          "x": -1796,
          "y": -360
        }
      },
      {
        "startHour": 22,
        "activity": "Rests at home",
        "location": {
          "x": -1820,
          "y": -400
        }
      }
    ],
    "relationshipToLeigneron": {
      "kind": "acquaintance",
      "trust": 55,
      "summary": "Sparred with Aldren before Leigneron was born and recognizes his stance"
    },
    "dialogue": [
      "Mentored Yselle; his family tends the western military gardens.",
      "Teaches controlled swordwork and maintains the drill ground. The city cannot live on decrees alone."
    ],
    "questIds": [],
    "patrolRadius": 48,
    "combatant": true,
    "weaponId": "oak-shield-blade",
    "storyConsequences": [
      "Responds to the grain inquiry and its chosen political outcome"
    ]
  },
  {
    "id": "nella-harrow",
    "name": "Nella Harrow",
    "title": "Lower Ward Weaver",
    "spriteTexture": "npc_villager",
    "townId": "highmere",
    "spriteFrame": 0,
    "worldOffset": {
      "x": -1110,
      "y": 1820
    },
    "role": "Records bread prices and argues for transparent relief accounts",
    "family": "Aunt to apprentice Iven; friend of Mairin",
    "faction": "Highmere Households",
    "connections": [
      {
        "npcId": "mairin-reed",
        "relationship": "Personal connection described in family and history"
      },
      {
        "npcId": "maela-quill",
        "relationship": "Personal connection described in family and history"
      }
    ],
    "dialoguePersonality": "Measured, practical, refuses to be spoken over",
    "homeLocation": {
      "x": -1110,
      "y": 1820
    },
    "schedule": [
      {
        "startHour": 6,
        "activity": "Records bread prices and argues for transparent relief accounts",
        "location": {
          "x": -1110,
          "y": 1820
        }
      },
      {
        "startHour": 18,
        "activity": "Meets neighbors outside the workplace",
        "location": {
          "x": -1086,
          "y": 1860
        }
      },
      {
        "startHour": 22,
        "activity": "Rests at home",
        "location": {
          "x": -1110,
          "y": 1820
        }
      }
    ],
    "relationshipToLeigneron": {
      "kind": "acquaintance",
      "trust": 55,
      "summary": "Wove a traveling blanket Leigneron’s mother carried on a relief caravan"
    },
    "dialogue": [
      "Aunt to apprentice Iven; friend of Mairin.",
      "Records bread prices and argues for transparent relief accounts. The city cannot live on decrees alone."
    ],
    "questIds": [],
    "patrolRadius": 48,
    "combatant": false,
    "storyConsequences": [
      "Responds to the grain inquiry and its chosen political outcome"
    ]
  },
  {
    "id": "iven-harrow",
    "name": "Iven Harrow",
    "title": "Relief Warehouse Apprentice",
    "spriteTexture": "npc_blacksmith",
    "townId": "highmere",
    "spriteFrame": 0,
    "worldOffset": {
      "x": 1940,
      "y": 2070
    },
    "role": "Repairs grain carts and keeps the warehouse’s physical stock tally",
    "family": "Nella Harrow is his aunt; trained briefly under Osric",
    "faction": "Highmere Households",
    "connections": [
      {
        "npcId": "nella-harrow",
        "relationship": "Personal connection described in family and history"
      },
      {
        "npcId": "osric-flint",
        "relationship": "Personal connection described in family and history"
      }
    ],
    "dialoguePersonality": "Earnest, excited by mechanisms and indignant about waste",
    "homeLocation": {
      "x": 1940,
      "y": 2070
    },
    "schedule": [
      {
        "startHour": 6,
        "activity": "Repairs grain carts and keeps the warehouse’s physical stock tally",
        "location": {
          "x": 1940,
          "y": 2070
        }
      },
      {
        "startHour": 18,
        "activity": "Meets neighbors outside the workplace",
        "location": {
          "x": 1964,
          "y": 2110
        }
      },
      {
        "startHour": 22,
        "activity": "Rests at home",
        "location": {
          "x": 1940,
          "y": 2070
        }
      }
    ],
    "relationshipToLeigneron": {
      "kind": "acquaintance",
      "trust": 55,
      "summary": "Joren introduced him to Leigneron while both were learning tool maintenance"
    },
    "dialogue": [
      "Nella Harrow is his aunt; trained briefly under Osric.",
      "Repairs grain carts and keeps the warehouse’s physical stock tally. The city cannot live on decrees alone."
    ],
    "questIds": [],
    "patrolRadius": 48,
    "combatant": false,
    "storyConsequences": [
      "Responds to the grain inquiry and its chosen political outcome"
    ]
  }
];

export const MARCH_ROUTE=HIGHMERE_MARCH_ROUTE;
export const MARCH_SPEED=38;
export const MARCH_SPACING=HIGHMERE_MARCH_SPACING;
export const MARCH_LENGTH=MARCH_ROUTE.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p.x-MARCH_ROUTE[i].x,p.y-MARCH_ROUTE[i].y),0);
const knights=[["odel-wren","Odel Wren","Sera’s patrol partner"],["bessa-holt","Bessa Holt","Garron’s younger sister"],["hugh-merrit","Hugh Merrit","Caldus’s former apprentice"],["sella-ford","Sella Ford","Eddan’s niece"],["orrik-pike","Orrik Pike","Joren and Halden’s distant cousin"],["mina-thorne","Mina Thorne","Barric’s daughter"]];
CAPITAL_RESIDENTS.push(...knights.map(([id,name,history],rank):NpcDefinition=>({
 id,name,title:'Crown Road Knight',townId:'highmere',role:'Marches the western ward circuit in a disciplined file',spriteTexture:'npc_royal_guard',spriteFrame:0,
 worldOffset:HIGHMERE_MARCH_STATIONS[id].position,formation:{id:'western-watch',rank},combatant:true,weaponId:'oak-shield-blade',
 faction:'Royal Guard',family:history,connections:[{npcId:'captain-yselle-ward',relationship:'Commanding officer'},{npcId:'ser-caldus-rowe',relationship:'Drill instructor'}],
 homeLocation:HIGHMERE_MARCH_STATIONS[id].home,schedule:[{startHour:6,activity:'Marches the western market and barracks circuit',location:HIGHMERE_MARCH_STATIONS[id].position},{startHour:20,activity:'Stands barracks watch',location:HIGHMERE_MARCH_STATIONS[id].home}],
 relationshipToLeigneron:{kind:'acquaintance',trust:45,summary:history+'; knows Leigneron through Aldren’s road service.'},
 dialogue:['Our file leaves the crossing clear. Caldus insists on spacing, even on quiet days.','Captain Yselle says the guard serves the kitchens as well as the castle.'],
 dialoguePersonality:'Disciplined but approachable',questIds:[],storyConsequences:['The Guard Trial secures the relief stores; political decisions affect patrol dialogue.'],
})));

export const REGIONAL_WORKERS:NpcDefinition[]=[
  {
    "id": "bela-reed",
    "name": "Bela Reed",
    "title": "River Innkeeper",
    "townId": "willowcross",
    "spriteTexture": "npc_attendant",
    "spriteFrame": 0,
    "worldOffset": {
      "x": -780,
      "y": 140
    },
    "role": "Serves bridge workers and trades flood news",
    "family": "Pella’s sister; hosted Torren’s stranded caravan",
    "homeLocation": {
      "x": -780,
      "y": 140
    },
    "faction": "Local Households",
    "dialoguePersonality": "Occupational knowledge, local loyalties",
    "connections": [],
    "schedule": [
      {
        "startHour": 6,
        "activity": "Serves bridge workers and trades flood news",
        "location": {
          "x": -780,
          "y": 140
        }
      },
      {
        "startHour": 18,
        "activity": "Shares the evening gathering place",
        "location": {
          "x": -748,
          "y": 172
        }
      },
      {
        "startHour": 22,
        "activity": "Rests beside the home court",
        "location": {
          "x": -780,
          "y": 140
        }
      }
    ],
    "relationshipToLeigneron": {
      "kind": "acquaintance",
      "trust": 48,
      "summary": "Pella’s sister; hosted Torren’s stranded caravan"
    },
    "dialogue": [
      "Pella’s sister; hosted Torren’s stranded caravan.",
      "Serves bridge workers and trades flood news. Keep the paths open; everybody here depends on them."
    ],
    "questIds": [],
    "patrolRadius": 56
  },
  {
    "id": "rowan-marr",
    "name": "Rowan Marr",
    "title": "Stable Hand",
    "townId": "willowcross",
    "spriteTexture": "npc_adventurer",
    "spriteFrame": 0,
    "worldOffset": {
      "x": -800,
      "y": 660
    },
    "role": "Tends road horses and water troughs",
    "family": "Tovan’s son; helped Mira fit her first saddle",
    "homeLocation": {
      "x": -800,
      "y": 660
    },
    "faction": "Local Households",
    "dialoguePersonality": "Occupational knowledge, local loyalties",
    "connections": [],
    "schedule": [
      {
        "startHour": 6,
        "activity": "Tends road horses and water troughs",
        "location": {
          "x": -800,
          "y": 660
        }
      },
      {
        "startHour": 18,
        "activity": "Shares the evening gathering place",
        "location": {
          "x": -768,
          "y": 692
        }
      },
      {
        "startHour": 22,
        "activity": "Rests beside the home court",
        "location": {
          "x": -800,
          "y": 660
        }
      }
    ],
    "relationshipToLeigneron": {
      "kind": "acquaintance",
      "trust": 48,
      "summary": "Tovan’s son; helped Mira fit her first saddle"
    },
    "dialogue": [
      "Tovan’s son; helped Mira fit her first saddle.",
      "Tends road horses and water troughs. Keep the paths open; everybody here depends on them."
    ],
    "questIds": [],
    "patrolRadius": 56
  },
  {
    "id": "aeris-thorneleaf",
    "name": "Aeris Thorneleaf",
    "title": "Ward Gardener",
    "townId": "elarion",
    "spriteTexture": "npc_villager",
    "spriteFrame": 0,
    "worldOffset": {
      "x": -800,
      "y": 110
    },
    "role": "Tends the lore court and protects living roots",
    "family": "Ilyra’s cousin; welcomed Leigneron’s parents on pilgrimage",
    "homeLocation": {
      "x": -800,
      "y": 110
    },
    "faction": "Local Households",
    "dialoguePersonality": "Occupational knowledge, local loyalties",
    "connections": [],
    "schedule": [
      {
        "startHour": 6,
        "activity": "Tends the lore court and protects living roots",
        "location": {
          "x": -800,
          "y": 110
        }
      },
      {
        "startHour": 18,
        "activity": "Shares the evening gathering place",
        "location": {
          "x": -768,
          "y": 142
        }
      },
      {
        "startHour": 22,
        "activity": "Rests beside the home court",
        "location": {
          "x": -800,
          "y": 110
        }
      }
    ],
    "relationshipToLeigneron": {
      "kind": "acquaintance",
      "trust": 48,
      "summary": "Ilyra’s cousin; welcomed Leigneron’s parents on pilgrimage"
    },
    "dialogue": [
      "Ilyra’s cousin; welcomed Leigneron’s parents on pilgrimage.",
      "Tends the lore court and protects living roots. Keep the paths open; everybody here depends on them."
    ],
    "questIds": [],
    "patrolRadius": 56
  },
  {
    "id": "haleth-virdan",
    "name": "Haleth Virdan",
    "title": "Bough Sentry",
    "townId": "elarion",
    "spriteTexture": "npc_guard",
    "spriteFrame": 0,
    "worldOffset": {
      "x": 800,
      "y": 760
    },
    "role": "Patrols the bowyard and watches forest approaches",
    "family": "Sael’s sibling; exchanged road signs with Aldren",
    "homeLocation": {
      "x": 800,
      "y": 760
    },
    "faction": "Local Households",
    "dialoguePersonality": "Occupational knowledge, local loyalties",
    "connections": [],
    "schedule": [
      {
        "startHour": 6,
        "activity": "Patrols the bowyard and watches forest approaches",
        "location": {
          "x": 800,
          "y": 760
        }
      },
      {
        "startHour": 18,
        "activity": "Shares the evening gathering place",
        "location": {
          "x": 832,
          "y": 792
        }
      },
      {
        "startHour": 22,
        "activity": "Rests beside the home court",
        "location": {
          "x": 800,
          "y": 760
        }
      }
    ],
    "relationshipToLeigneron": {
      "kind": "acquaintance",
      "trust": 48,
      "summary": "Sael’s sibling; exchanged road signs with Aldren"
    },
    "dialogue": [
      "Sael’s sibling; exchanged road signs with Aldren.",
      "Patrols the bowyard and watches forest approaches. Keep the paths open; everybody here depends on them."
    ],
    "questIds": [],
    "patrolRadius": 56
  },
  {
    "id": "suri-mosswalk",
    "name": "Suri Mosswalk",
    "title": "Dew Gatherer",
    "townId": "moonfall",
    "spriteTexture": "npc_villager",
    "spriteFrame": 0,
    "worldOffset": {
      "x": -600,
      "y": 160
    },
    "role": "Harvests healing herbs without stripping the grove",
    "family": "Eren’s niece; shares herb recipes with Mira",
    "homeLocation": {
      "x": -600,
      "y": 160
    },
    "faction": "Local Households",
    "dialoguePersonality": "Occupational knowledge, local loyalties",
    "connections": [],
    "schedule": [
      {
        "startHour": 6,
        "activity": "Harvests healing herbs without stripping the grove",
        "location": {
          "x": -600,
          "y": 160
        }
      },
      {
        "startHour": 18,
        "activity": "Shares the evening gathering place",
        "location": {
          "x": -568,
          "y": 192
        }
      },
      {
        "startHour": 22,
        "activity": "Rests beside the home court",
        "location": {
          "x": -600,
          "y": 160
        }
      }
    ],
    "relationshipToLeigneron": {
      "kind": "acquaintance",
      "trust": 48,
      "summary": "Eren’s niece; shares herb recipes with Mira"
    },
    "dialogue": [
      "Eren’s niece; shares herb recipes with Mira.",
      "Harvests healing herbs without stripping the grove. Keep the paths open; everybody here depends on them."
    ],
    "questIds": [],
    "patrolRadius": 56
  },
  {
    "id": "dael-vale",
    "name": "Dael Vale",
    "title": "Grove Host",
    "townId": "moonfall",
    "spriteTexture": "npc_attendant",
    "spriteFrame": 0,
    "worldOffset": {
      "x": 580,
      "y": 120
    },
    "role": "Maintains the travelers shelter and moon rites",
    "family": "Neris’s brother; sheltered Aldren during winter patrols",
    "homeLocation": {
      "x": 580,
      "y": 120
    },
    "faction": "Local Households",
    "dialoguePersonality": "Occupational knowledge, local loyalties",
    "connections": [],
    "schedule": [
      {
        "startHour": 6,
        "activity": "Maintains the travelers shelter and moon rites",
        "location": {
          "x": 580,
          "y": 120
        }
      },
      {
        "startHour": 18,
        "activity": "Shares the evening gathering place",
        "location": {
          "x": 612,
          "y": 152
        }
      },
      {
        "startHour": 22,
        "activity": "Rests beside the home court",
        "location": {
          "x": 580,
          "y": 120
        }
      }
    ],
    "relationshipToLeigneron": {
      "kind": "acquaintance",
      "trust": 48,
      "summary": "Neris’s brother; sheltered Aldren during winter patrols"
    },
    "dialogue": [
      "Neris’s brother; sheltered Aldren during winter patrols.",
      "Maintains the travelers shelter and moon rites. Keep the paths open; everybody here depends on them."
    ],
    "questIds": [],
    "patrolRadius": 56
  },
  {
    "id": "freya-skell",
    "name": "Freya Skell",
    "title": "Rope Maker",
    "townId": "starhold",
    "spriteTexture": "npc_villager",
    "spriteFrame": 0,
    "worldOffset": {
      "x": -720,
      "y": 720
    },
    "role": "Repairs climbing ropes and measures snow risk",
    "family": "Borin’s daughter; learned knots from Torren",
    "homeLocation": {
      "x": -720,
      "y": 720
    },
    "faction": "Local Households",
    "dialoguePersonality": "Occupational knowledge, local loyalties",
    "connections": [],
    "schedule": [
      {
        "startHour": 6,
        "activity": "Repairs climbing ropes and measures snow risk",
        "location": {
          "x": -720,
          "y": 720
        }
      },
      {
        "startHour": 18,
        "activity": "Shares the evening gathering place",
        "location": {
          "x": -688,
          "y": 752
        }
      },
      {
        "startHour": 22,
        "activity": "Rests beside the home court",
        "location": {
          "x": -720,
          "y": 720
        }
      }
    ],
    "relationshipToLeigneron": {
      "kind": "acquaintance",
      "trust": 48,
      "summary": "Borin’s daughter; learned knots from Torren"
    },
    "dialogue": [
      "Borin’s daughter; learned knots from Torren.",
      "Repairs climbing ropes and measures snow risk. Keep the paths open; everybody here depends on them."
    ],
    "questIds": [],
    "patrolRadius": 56
  },
  {
    "id": "tor-beacon",
    "name": "Tor Beacon",
    "title": "Pass Sentry",
    "townId": "starhold",
    "spriteTexture": "npc_guard",
    "spriteFrame": 0,
    "worldOffset": {
      "x": 960,
      "y": 120
    },
    "role": "Guards the caravan terrace and beacon stores",
    "family": "Halla’s sworn watch partner; carried Sena’s mountain deliveries",
    "homeLocation": {
      "x": 960,
      "y": 120
    },
    "faction": "Local Households",
    "dialoguePersonality": "Occupational knowledge, local loyalties",
    "connections": [],
    "schedule": [
      {
        "startHour": 6,
        "activity": "Guards the caravan terrace and beacon stores",
        "location": {
          "x": 960,
          "y": 120
        }
      },
      {
        "startHour": 18,
        "activity": "Shares the evening gathering place",
        "location": {
          "x": 992,
          "y": 152
        }
      },
      {
        "startHour": 22,
        "activity": "Rests beside the home court",
        "location": {
          "x": 960,
          "y": 120
        }
      }
    ],
    "relationshipToLeigneron": {
      "kind": "acquaintance",
      "trust": 48,
      "summary": "Halla’s sworn watch partner; carried Sena’s mountain deliveries"
    },
    "dialogue": [
      "Halla’s sworn watch partner; carried Sena’s mountain deliveries.",
      "Guards the caravan terrace and beacon stores. Keep the paths open; everybody here depends on them."
    ],
    "questIds": [],
    "patrolRadius": 56
  },
  {
    "id": "torga-ashhand",
    "name": "Torga Ashhand",
    "title": "Ore Trader",
    "townId": "redmesa",
    "spriteTexture": "npc_adventurer",
    "spriteFrame": 0,
    "worldOffset": {
      "x": -730,
      "y": 100
    },
    "role": "Bargains for ore at the clan market",
    "family": "Dorga’s sister; supplied iron for Joren’s workshop",
    "homeLocation": {
      "x": -730,
      "y": 100
    },
    "faction": "Local Households",
    "dialoguePersonality": "Occupational knowledge, local loyalties",
    "connections": [],
    "schedule": [
      {
        "startHour": 6,
        "activity": "Bargains for ore at the clan market",
        "location": {
          "x": -730,
          "y": 100
        }
      },
      {
        "startHour": 18,
        "activity": "Shares the evening gathering place",
        "location": {
          "x": -698,
          "y": 132
        }
      },
      {
        "startHour": 22,
        "activity": "Rests beside the home court",
        "location": {
          "x": -730,
          "y": 100
        }
      }
    ],
    "relationshipToLeigneron": {
      "kind": "acquaintance",
      "trust": 48,
      "summary": "Dorga’s sister; supplied iron for Joren’s workshop"
    },
    "dialogue": [
      "Dorga’s sister; supplied iron for Joren’s workshop.",
      "Bargains for ore at the clan market. Keep the paths open; everybody here depends on them."
    ],
    "questIds": [],
    "patrolRadius": 56
  },
  {
    "id": "kesh-flintmane",
    "name": "Kesh Flintmane",
    "title": "Young Rider",
    "townId": "redmesa",
    "spriteTexture": "npc_adventurer",
    "spriteFrame": 0,
    "worldOffset": {
      "x": 730,
      "y": 710
    },
    "role": "Practices disciplined mounted-ground drills",
    "family": "Ugra’s nephew; remembers Aldren calming a frightened war-boar",
    "homeLocation": {
      "x": 730,
      "y": 710
    },
    "faction": "Local Households",
    "dialoguePersonality": "Occupational knowledge, local loyalties",
    "connections": [],
    "schedule": [
      {
        "startHour": 6,
        "activity": "Practices disciplined mounted-ground drills",
        "location": {
          "x": 730,
          "y": 710
        }
      },
      {
        "startHour": 18,
        "activity": "Shares the evening gathering place",
        "location": {
          "x": 762,
          "y": 742
        }
      },
      {
        "startHour": 22,
        "activity": "Rests beside the home court",
        "location": {
          "x": 730,
          "y": 710
        }
      }
    ],
    "relationshipToLeigneron": {
      "kind": "acquaintance",
      "trust": 48,
      "summary": "Ugra’s nephew; remembers Aldren calming a frightened war-boar"
    },
    "dialogue": [
      "Ugra’s nephew; remembers Aldren calming a frightened war-boar.",
      "Practices disciplined mounted-ground drills. Keep the paths open; everybody here depends on them."
    ],
    "questIds": [],
    "patrolRadius": 56
  },
  {
    "id": "ketra-copperwake",
    "name": "Ketra Copperwake",
    "title": "River Host",
    "townId": "deepford",
    "spriteTexture": "npc_attendant",
    "spriteFrame": 0,
    "worldOffset": {
      "x": -760,
      "y": 700
    },
    "role": "Keeps guild travelers supplied beside the river",
    "family": "Thrain’s daughter; feeds Torren’s ferry crews",
    "homeLocation": {
      "x": -760,
      "y": 700
    },
    "faction": "Local Households",
    "dialoguePersonality": "Occupational knowledge, local loyalties",
    "connections": [],
    "schedule": [
      {
        "startHour": 6,
        "activity": "Keeps guild travelers supplied beside the river",
        "location": {
          "x": -760,
          "y": 700
        }
      },
      {
        "startHour": 18,
        "activity": "Shares the evening gathering place",
        "location": {
          "x": -728,
          "y": 732
        }
      },
      {
        "startHour": 22,
        "activity": "Rests beside the home court",
        "location": {
          "x": -760,
          "y": 700
        }
      }
    ],
    "relationshipToLeigneron": {
      "kind": "acquaintance",
      "trust": 48,
      "summary": "Thrain’s daughter; feeds Torren’s ferry crews"
    },
    "dialogue": [
      "Thrain’s daughter; feeds Torren’s ferry crews.",
      "Keeps guild travelers supplied beside the river. Keep the paths open; everybody here depends on them."
    ],
    "questIds": [],
    "patrolRadius": 56
  },
  {
    "id": "brann-stonevein",
    "name": "Brann Stonevein",
    "title": "Rune Apprentice",
    "townId": "deepford",
    "spriteTexture": "npc_blacksmith",
    "spriteFrame": 0,
    "worldOffset": {
      "x": 820,
      "y": 110
    },
    "role": "Repairs protective fittings at the mine guild",
    "family": "Mara’s cousin; copied ward marks from Leigneron’s mother’s notes",
    "homeLocation": {
      "x": 820,
      "y": 110
    },
    "faction": "Local Households",
    "dialoguePersonality": "Occupational knowledge, local loyalties",
    "connections": [],
    "schedule": [
      {
        "startHour": 6,
        "activity": "Repairs protective fittings at the mine guild",
        "location": {
          "x": 820,
          "y": 110
        }
      },
      {
        "startHour": 18,
        "activity": "Shares the evening gathering place",
        "location": {
          "x": 852,
          "y": 142
        }
      },
      {
        "startHour": 22,
        "activity": "Rests beside the home court",
        "location": {
          "x": 820,
          "y": 110
        }
      }
    ],
    "relationshipToLeigneron": {
      "kind": "acquaintance",
      "trust": 48,
      "summary": "Mara’s cousin; copied ward marks from Leigneron’s mother’s notes"
    },
    "dialogue": [
      "Mara’s cousin; copied ward marks from Leigneron’s mother’s notes.",
      "Repairs protective fittings at the mine guild. Keep the paths open; everybody here depends on them."
    ],
    "questIds": [],
    "patrolRadius": 56
  },
  {
    "id": "finn-gull",
    "name": "Finn Gull",
    "title": "Quay Porter",
    "townId": "tidewatch",
    "spriteTexture": "npc_adventurer",
    "spriteFrame": 0,
    "worldOffset": {
      "x": -770,
      "y": 710
    },
    "role": "Moves cargo between customs and the quay",
    "family": "Jessa’s brother; unloaded the Oakmere medicine shipment",
    "homeLocation": {
      "x": -770,
      "y": 710
    },
    "faction": "Local Households",
    "dialoguePersonality": "Occupational knowledge, local loyalties",
    "connections": [],
    "schedule": [
      {
        "startHour": 6,
        "activity": "Moves cargo between customs and the quay",
        "location": {
          "x": -770,
          "y": 710
        }
      },
      {
        "startHour": 18,
        "activity": "Shares the evening gathering place",
        "location": {
          "x": -738,
          "y": 742
        }
      },
      {
        "startHour": 22,
        "activity": "Rests beside the home court",
        "location": {
          "x": -770,
          "y": 710
        }
      }
    ],
    "relationshipToLeigneron": {
      "kind": "acquaintance",
      "trust": 48,
      "summary": "Jessa’s brother; unloaded the Oakmere medicine shipment"
    },
    "dialogue": [
      "Jessa’s brother; unloaded the Oakmere medicine shipment.",
      "Moves cargo between customs and the quay. Keep the paths open; everybody here depends on them."
    ],
    "questIds": [],
    "patrolRadius": 56
  },
  {
    "id": "lysa-vane",
    "name": "Lysa Vane",
    "title": "Canvas Merchant",
    "townId": "tidewatch",
    "spriteTexture": "npc_villager",
    "spriteFrame": 0,
    "worldOffset": {
      "x": 780,
      "y": 110
    },
    "role": "Trades canvas and storm provisions at the market",
    "family": "Orren’s cousin; stitched Mira’s weatherproof cloak",
    "homeLocation": {
      "x": 780,
      "y": 110
    },
    "faction": "Local Households",
    "dialoguePersonality": "Occupational knowledge, local loyalties",
    "connections": [],
    "schedule": [
      {
        "startHour": 6,
        "activity": "Trades canvas and storm provisions at the market",
        "location": {
          "x": 780,
          "y": 110
        }
      },
      {
        "startHour": 18,
        "activity": "Shares the evening gathering place",
        "location": {
          "x": 812,
          "y": 142
        }
      },
      {
        "startHour": 22,
        "activity": "Rests beside the home court",
        "location": {
          "x": 780,
          "y": 110
        }
      }
    ],
    "relationshipToLeigneron": {
      "kind": "acquaintance",
      "trust": 48,
      "summary": "Orren’s cousin; stitched Mira’s weatherproof cloak"
    },
    "dialogue": [
      "Orren’s cousin; stitched Mira’s weatherproof cloak.",
      "Trades canvas and storm provisions at the market. Keep the paths open; everybody here depends on them."
    ],
    "questIds": [],
    "patrolRadius": 56
  },
  {
    "id": "assa-icevein",
    "name": "Assa Icevein",
    "title": "Longhouse Host",
    "townId": "skallheim",
    "spriteTexture": "npc_attendant",
    "spriteFrame": 0,
    "worldOffset": {
      "x": -760,
      "y": 120
    },
    "role": "Shares warm meals and tracks winter stores",
    "family": "Runa’s sister; sheltered an Oakmere relief crew in a blizzard",
    "homeLocation": {
      "x": -760,
      "y": 120
    },
    "faction": "Local Households",
    "dialoguePersonality": "Occupational knowledge, local loyalties",
    "connections": [],
    "schedule": [
      {
        "startHour": 6,
        "activity": "Shares warm meals and tracks winter stores",
        "location": {
          "x": -760,
          "y": 120
        }
      },
      {
        "startHour": 18,
        "activity": "Shares the evening gathering place",
        "location": {
          "x": -728,
          "y": 152
        }
      },
      {
        "startHour": 22,
        "activity": "Rests beside the home court",
        "location": {
          "x": -760,
          "y": 120
        }
      }
    ],
    "relationshipToLeigneron": {
      "kind": "acquaintance",
      "trust": 48,
      "summary": "Runa’s sister; sheltered an Oakmere relief crew in a blizzard"
    },
    "dialogue": [
      "Runa’s sister; sheltered an Oakmere relief crew in a blizzard.",
      "Shares warm meals and tracks winter stores. Keep the paths open; everybody here depends on them."
    ],
    "questIds": [],
    "patrolRadius": 56
  },
  {
    "id": "stenn-harrow",
    "name": "Stenn Harrow",
    "title": "Fish Porter",
    "townId": "skallheim",
    "spriteTexture": "npc_adventurer",
    "spriteFrame": 0,
    "worldOffset": {
      "x": -760,
      "y": 720
    },
    "role": "Carries fish and keeps the quay free of ice",
    "family": "Eyvind’s son; carried Aldren’s letters ashore",
    "homeLocation": {
      "x": -760,
      "y": 720
    },
    "faction": "Local Households",
    "dialoguePersonality": "Occupational knowledge, local loyalties",
    "connections": [],
    "schedule": [
      {
        "startHour": 6,
        "activity": "Carries fish and keeps the quay free of ice",
        "location": {
          "x": -760,
          "y": 720
        }
      },
      {
        "startHour": 18,
        "activity": "Shares the evening gathering place",
        "location": {
          "x": -728,
          "y": 752
        }
      },
      {
        "startHour": 22,
        "activity": "Rests beside the home court",
        "location": {
          "x": -760,
          "y": 720
        }
      }
    ],
    "relationshipToLeigneron": {
      "kind": "acquaintance",
      "trust": 48,
      "summary": "Eyvind’s son; carried Aldren’s letters ashore"
    },
    "dialogue": [
      "Eyvind’s son; carried Aldren’s letters ashore.",
      "Carries fish and keeps the quay free of ice. Keep the paths open; everybody here depends on them."
    ],
    "questIds": [],
    "patrolRadius": 56
  },
  {
    "id": "nia-cinder",
    "name": "Nia Cinder",
    "title": "Chainwright",
    "townId": "blackspire",
    "spriteTexture": "npc_blacksmith",
    "spriteFrame": 0,
    "worldOffset": {
      "x": -760,
      "y": 710
    },
    "role": "Repairs the chainworks and protects furnace workers",
    "family": "Vexa’s daughter; helped reject the village-raid contract",
    "homeLocation": {
      "x": -760,
      "y": 710
    },
    "faction": "Local Households",
    "dialoguePersonality": "Occupational knowledge, local loyalties",
    "connections": [],
    "schedule": [
      {
        "startHour": 6,
        "activity": "Repairs the chainworks and protects furnace workers",
        "location": {
          "x": -760,
          "y": 710
        }
      },
      {
        "startHour": 18,
        "activity": "Shares the evening gathering place",
        "location": {
          "x": -728,
          "y": 742
        }
      },
      {
        "startHour": 22,
        "activity": "Rests beside the home court",
        "location": {
          "x": -760,
          "y": 710
        }
      }
    ],
    "relationshipToLeigneron": {
      "kind": "acquaintance",
      "trust": 48,
      "summary": "Vexa’s daughter; helped reject the village-raid contract"
    },
    "dialogue": [
      "Vexa’s daughter; helped reject the village-raid contract.",
      "Repairs the chainworks and protects furnace workers. Keep the paths open; everybody here depends on them."
    ],
    "questIds": [],
    "patrolRadius": 56
  },
  {
    "id": "orren-emberfall",
    "name": "Orren Emberfall",
    "title": "Ash Provisioner",
    "townId": "blackspire",
    "spriteTexture": "npc_adventurer",
    "spriteFrame": 0,
    "worldOffset": {
      "x": 780,
      "y": 110
    },
    "role": "Keeps food covered and road signs readable",
    "family": "Dain’s uncle; stocked Aldren’s old border patrol",
    "homeLocation": {
      "x": 780,
      "y": 110
    },
    "faction": "Local Households",
    "dialoguePersonality": "Occupational knowledge, local loyalties",
    "connections": [],
    "schedule": [
      {
        "startHour": 6,
        "activity": "Keeps food covered and road signs readable",
        "location": {
          "x": 780,
          "y": 110
        }
      },
      {
        "startHour": 18,
        "activity": "Shares the evening gathering place",
        "location": {
          "x": 812,
          "y": 142
        }
      },
      {
        "startHour": 22,
        "activity": "Rests beside the home court",
        "location": {
          "x": 780,
          "y": 110
        }
      }
    ],
    "relationshipToLeigneron": {
      "kind": "acquaintance",
      "trust": 48,
      "summary": "Dain’s uncle; stocked Aldren’s old border patrol"
    },
    "dialogue": [
      "Dain’s uncle; stocked Aldren’s old border patrol.",
      "Keeps food covered and road signs readable. Keep the paths open; everybody here depends on them."
    ],
    "questIds": [],
    "patrolRadius": 56
  }
];
