// NPCs and Quests for Map Locations

export const locationData = [
  {
    name: "Prescott Farm",
    description: "An abandoned farmstead once overtaken by the Kaorti, now partially reclaimed.",
    npcs: [
      {
        name: "Rinshin Duskwhisper",
        backstory: "A tiefling scout from Mercia who survived the Kaorti ambush at Prescott Farm. Now watches over the ruins, investigating residual corruption."
      },
      {
        name: "Old Merta",
        backstory: "A ghostly figure of the original farmer’s wife. Bound to the land, offering cryptic warnings to travelers."
      },
      {
        name: "Sergeant Harn",
        backstory: "A hardened dwarven soldier from Fort Tiber tasked with guarding the reopened tunnel paths. Suspects deeper Kaorti presence."
      }
    ],
    quests: [
      {
        title: "Echoes in the Cellar",
        status: "Available",
        description: "Rinshin believes something still lurks in the blocked tunnels. Investigate with him and uncover what remains of the Kaorti forces."
      },
      {
        title: "The Whispering Grove",
        status: "Available",
        description: "Old Merta’s ghost points toward a cursed grove behind the farm. Purge the unnatural flora feeding on residual rift energy."
      }
    ]
  },
  {
    name: "Gray Hall",
    description: "The proud capital of the Mountain Dwarves, fortified deep beneath the mountains.",
    npcs: [
      {
        name: "Thrain Ironbrow",
        backstory: "Leader of the Mountain Dwarves. Wise and wearied by years of war with the Drow and the recent Kaorti incursions."
      },
      {
        name: "Mara Stonevein",
        backstory: "A brilliant dwarven mage studying the Far Realm energies seeping into the Underdark tunnels."
      },
      {
        name: "Borik Stonethrower",
        backstory: "Gray Hall’s loudest and proudest warrior. Recently lost his brother in a Kaorti ambush."
      }
    ],
    quests: [
      {
        title: "Runes of Resistance",
        status: "Available",
        description: "Mara needs rare crystals from the tunnels to power protective runes. Retrieve them while avoiding Kaorti corruption."
      },
      {
        title: "The Lost Patrol",
        status: "Available",
        description: "Borik asks for help locating his brother’s missing squad in the lower Underdark near Kaorti zones."
      }
    ]
  },
  {
    name: "Fort Tiber",
    description: "Once a ruined dwarven fort, now rebuilt by a thriving tribe of orcs under the rule of Mog.",
    npcs: [
      {
        name: "Mog the Reforged",
        backstory: "A former warlord turned visionary leader. Seeks to prove Orcs can thrive honorably without conquest."
      },
      {
        name: "Zeezil the Sharp",
        backstory: "A goblin scribe serving Mog. Records oral histories and keeps tabs on Kaorti threats in the tunnels."
      },
      {
        name: "Korga of the Smoke-Eaters",
        backstory: "An elder orc shaman attuned to spiritual disturbances in the stone. Claims the fort sits on a ley fracture."
      }
    ],
    quests: [
      {
        title: "The Shadow Below",
        status: "Available",
        description: "Korga warns that a strange presence awakens beneath the fort. Venture into the oldest tunnels to cleanse the echoing madness."
      },
      {
        title: "The Pact Rekindled",
        status: "Available",
        description: "Mog hopes to forge an alliance with Gray Hall. Serve as emissary to deliver a token of truce—if you can survive the journey."
      }
    ]
  }
];
