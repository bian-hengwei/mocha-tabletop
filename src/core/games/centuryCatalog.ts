// Base card values cross-checked against independent catalogs; see docs/ASSETS.md.
import type {SpiceCard,SpiceOrder} from './century';
export const BASE_MERCHANTS:SpiceCard[]=[
  {
    "id": "trade-0",
    "type": "trade",
    "cost": [
      1,
      1,
      0,
      0
    ],
    "gain": [
      0,
      0,
      0,
      1
    ],
    "upgrades": 0
  },
  {
    "id": "trade-1",
    "type": "trade",
    "cost": [
      0,
      0,
      1,
      0
    ],
    "gain": [
      1,
      2,
      0,
      0
    ],
    "upgrades": 0
  },
  {
    "id": "trade-2",
    "type": "trade",
    "cost": [
      0,
      0,
      0,
      1
    ],
    "gain": [
      0,
      3,
      0,
      0
    ],
    "upgrades": 0
  },
  {
    "id": "trade-3",
    "type": "trade",
    "cost": [
      0,
      0,
      2,
      0
    ],
    "gain": [
      0,
      0,
      0,
      2
    ],
    "upgrades": 0
  },
  {
    "id": "trade-4",
    "type": "trade",
    "cost": [
      5,
      0,
      0,
      0
    ],
    "gain": [
      0,
      0,
      3,
      0
    ],
    "upgrades": 0
  },
  {
    "id": "trade-5",
    "type": "trade",
    "cost": [
      4,
      0,
      0,
      0
    ],
    "gain": [
      0,
      0,
      1,
      1
    ],
    "upgrades": 0
  },
  {
    "id": "trade-6",
    "type": "trade",
    "cost": [
      0,
      3,
      0,
      0
    ],
    "gain": [
      2,
      0,
      2,
      0
    ],
    "upgrades": 0
  },
  {
    "id": "trade-7",
    "type": "trade",
    "cost": [
      0,
      0,
      2,
      0
    ],
    "gain": [
      0,
      2,
      0,
      1
    ],
    "upgrades": 0
  },
  {
    "id": "trade-8",
    "type": "trade",
    "cost": [
      0,
      2,
      0,
      0
    ],
    "gain": [
      2,
      0,
      0,
      1
    ],
    "upgrades": 0
  },
  {
    "id": "trade-9",
    "type": "trade",
    "cost": [
      0,
      0,
      0,
      2
    ],
    "gain": [
      0,
      3,
      2,
      0
    ],
    "upgrades": 0
  },
  {
    "id": "trade-10",
    "type": "trade",
    "cost": [
      0,
      3,
      0,
      0
    ],
    "gain": [
      0,
      0,
      0,
      2
    ],
    "upgrades": 0
  },
  {
    "id": "trade-11",
    "type": "trade",
    "cost": [
      0,
      0,
      1,
      0
    ],
    "gain": [
      0,
      2,
      0,
      0
    ],
    "upgrades": 0
  },
  {
    "id": "trade-12",
    "type": "trade",
    "cost": [
      0,
      0,
      2,
      0
    ],
    "gain": [
      2,
      3,
      0,
      0
    ],
    "upgrades": 0
  },
  {
    "id": "trade-13",
    "type": "trade",
    "cost": [
      5,
      0,
      0,
      0
    ],
    "gain": [
      0,
      0,
      0,
      2
    ],
    "upgrades": 0
  },
  {
    "id": "trade-14",
    "type": "trade",
    "cost": [
      0,
      0,
      0,
      1
    ],
    "gain": [
      3,
      0,
      1,
      0
    ],
    "upgrades": 0
  },
  {
    "id": "trade-15",
    "type": "trade",
    "cost": [
      0,
      1,
      0,
      0
    ],
    "gain": [
      3,
      0,
      0,
      0
    ],
    "upgrades": 0
  },
  {
    "id": "trade-16",
    "type": "trade",
    "cost": [
      2,
      0,
      1,
      0
    ],
    "gain": [
      0,
      0,
      0,
      2
    ],
    "upgrades": 0
  },
  {
    "id": "trade-17",
    "type": "trade",
    "cost": [
      0,
      0,
      2,
      0
    ],
    "gain": [
      2,
      1,
      0,
      1
    ],
    "upgrades": 0
  },
  {
    "id": "trade-18",
    "type": "trade",
    "cost": [
      0,
      2,
      0,
      0
    ],
    "gain": [
      3,
      0,
      1,
      0
    ],
    "upgrades": 0
  },
  {
    "id": "trade-19",
    "type": "trade",
    "cost": [
      3,
      0,
      0,
      0
    ],
    "gain": [
      0,
      3,
      0,
      0
    ],
    "upgrades": 0
  },
  {
    "id": "trade-20",
    "type": "trade",
    "cost": [
      0,
      0,
      0,
      1
    ],
    "gain": [
      2,
      2,
      0,
      0
    ],
    "upgrades": 0
  },
  {
    "id": "trade-21",
    "type": "trade",
    "cost": [
      0,
      0,
      3,
      0
    ],
    "gain": [
      0,
      0,
      0,
      3
    ],
    "upgrades": 0
  },
  {
    "id": "trade-22",
    "type": "trade",
    "cost": [
      0,
      0,
      0,
      1
    ],
    "gain": [
      1,
      1,
      1,
      0
    ],
    "upgrades": 0
  },
  {
    "id": "trade-23",
    "type": "trade",
    "cost": [
      4,
      0,
      0,
      0
    ],
    "gain": [
      0,
      0,
      2,
      0
    ],
    "upgrades": 0
  },
  {
    "id": "trade-24",
    "type": "trade",
    "cost": [
      3,
      0,
      0,
      0
    ],
    "gain": [
      0,
      1,
      1,
      0
    ],
    "upgrades": 0
  },
  {
    "id": "trade-25",
    "type": "trade",
    "cost": [
      0,
      3,
      0,
      0
    ],
    "gain": [
      0,
      0,
      3,
      0
    ],
    "upgrades": 0
  },
  {
    "id": "trade-26",
    "type": "trade",
    "cost": [
      0,
      2,
      0,
      0
    ],
    "gain": [
      0,
      0,
      2,
      0
    ],
    "upgrades": 0
  },
  {
    "id": "trade-27",
    "type": "trade",
    "cost": [
      0,
      0,
      0,
      2
    ],
    "gain": [
      1,
      1,
      3,
      0
    ],
    "upgrades": 0
  },
  {
    "id": "trade-28",
    "type": "trade",
    "cost": [
      2,
      0,
      0,
      0
    ],
    "gain": [
      0,
      0,
      1,
      0
    ],
    "upgrades": 0
  },
  {
    "id": "trade-29",
    "type": "trade",
    "cost": [
      0,
      3,
      0,
      0
    ],
    "gain": [
      1,
      0,
      1,
      1
    ],
    "upgrades": 0
  },
  {
    "id": "trade-30",
    "type": "trade",
    "cost": [
      2,
      0,
      0,
      0
    ],
    "gain": [
      0,
      2,
      0,
      0
    ],
    "upgrades": 0
  },
  {
    "id": "trade-31",
    "type": "trade",
    "cost": [
      0,
      0,
      1,
      0
    ],
    "gain": [
      4,
      1,
      0,
      0
    ],
    "upgrades": 0
  },
  {
    "id": "trade-32",
    "type": "trade",
    "cost": [
      3,
      0,
      0,
      0
    ],
    "gain": [
      0,
      0,
      0,
      1
    ],
    "upgrades": 0
  },
  {
    "id": "trade-33",
    "type": "trade",
    "cost": [
      0,
      0,
      0,
      1
    ],
    "gain": [
      0,
      0,
      2,
      0
    ],
    "upgrades": 0
  },
  {
    "id": "gain-0",
    "type": "gain",
    "cost": [
      0,
      0,
      0,
      0
    ],
    "gain": [
      3,
      0,
      0,
      0
    ],
    "upgrades": 0
  },
  {
    "id": "gain-1",
    "type": "gain",
    "cost": [
      0,
      0,
      0,
      0
    ],
    "gain": [
      4,
      0,
      0,
      0
    ],
    "upgrades": 0
  },
  {
    "id": "gain-2",
    "type": "gain",
    "cost": [
      0,
      0,
      0,
      0
    ],
    "gain": [
      0,
      2,
      0,
      0
    ],
    "upgrades": 0
  },
  {
    "id": "gain-3",
    "type": "gain",
    "cost": [
      0,
      0,
      0,
      0
    ],
    "gain": [
      2,
      1,
      0,
      0
    ],
    "upgrades": 0
  },
  {
    "id": "gain-4",
    "type": "gain",
    "cost": [
      0,
      0,
      0,
      0
    ],
    "gain": [
      1,
      1,
      0,
      0
    ],
    "upgrades": 0
  },
  {
    "id": "gain-5",
    "type": "gain",
    "cost": [
      0,
      0,
      0,
      0
    ],
    "gain": [
      1,
      0,
      1,
      0
    ],
    "upgrades": 0
  },
  {
    "id": "gain-6",
    "type": "gain",
    "cost": [
      0,
      0,
      0,
      0
    ],
    "gain": [
      0,
      0,
      1,
      0
    ],
    "upgrades": 0
  },
  {
    "id": "gain-7",
    "type": "gain",
    "cost": [
      0,
      0,
      0,
      0
    ],
    "gain": [
      0,
      0,
      0,
      1
    ],
    "upgrades": 0
  },
  {
    "id": "upgrade-0",
    "type": "upgrade",
    "cost": [
      0,
      0,
      0,
      0
    ],
    "gain": [
      0,
      0,
      0,
      0
    ],
    "upgrades": 3
  }
];
export const BASE_ORDERS:SpiceOrder[]=[
  {
    "id": "order-0",
    "cost": [
      3,
      0,
      2,
      0
    ],
    "points": 9
  },
  {
    "id": "order-1",
    "cost": [
      2,
      0,
      2,
      2
    ],
    "points": 17
  },
  {
    "id": "order-2",
    "cost": [
      2,
      2,
      2,
      0
    ],
    "points": 13
  },
  {
    "id": "order-3",
    "cost": [
      0,
      2,
      2,
      2
    ],
    "points": 19
  },
  {
    "id": "order-4",
    "cost": [
      2,
      2,
      0,
      0
    ],
    "points": 6
  },
  {
    "id": "order-5",
    "cost": [
      0,
      0,
      2,
      2
    ],
    "points": 14
  },
  {
    "id": "order-6",
    "cost": [
      0,
      0,
      3,
      2
    ],
    "points": 17
  },
  {
    "id": "order-7",
    "cost": [
      0,
      0,
      0,
      5
    ],
    "points": 20
  },
  {
    "id": "order-8",
    "cost": [
      1,
      1,
      1,
      3
    ],
    "points": 20
  },
  {
    "id": "order-9",
    "cost": [
      2,
      0,
      0,
      2
    ],
    "points": 10
  },
  {
    "id": "order-10",
    "cost": [
      0,
      3,
      0,
      2
    ],
    "points": 14
  },
  {
    "id": "order-11",
    "cost": [
      0,
      2,
      0,
      2
    ],
    "points": 12
  },
  {
    "id": "order-12",
    "cost": [
      2,
      0,
      3,
      0
    ],
    "points": 11
  },
  {
    "id": "order-13",
    "cost": [
      0,
      3,
      2,
      0
    ],
    "points": 12
  },
  {
    "id": "order-14",
    "cost": [
      0,
      2,
      1,
      1
    ],
    "points": 12
  },
  {
    "id": "order-15",
    "cost": [
      2,
      3,
      0,
      0
    ],
    "points": 8
  },
  {
    "id": "order-16",
    "cost": [
      0,
      2,
      3,
      0
    ],
    "points": 13
  },
  {
    "id": "order-17",
    "cost": [
      3,
      0,
      0,
      2
    ],
    "points": 11
  },
  {
    "id": "order-18",
    "cost": [
      2,
      0,
      0,
      3
    ],
    "points": 14
  },
  {
    "id": "order-19",
    "cost": [
      0,
      0,
      4,
      0
    ],
    "points": 12
  },
  {
    "id": "order-20",
    "cost": [
      1,
      1,
      3,
      1
    ],
    "points": 18
  },
  {
    "id": "order-21",
    "cost": [
      1,
      0,
      2,
      1
    ],
    "points": 12
  },
  {
    "id": "order-22",
    "cost": [
      3,
      1,
      1,
      1
    ],
    "points": 14
  },
  {
    "id": "order-23",
    "cost": [
      1,
      1,
      1,
      1
    ],
    "points": 12
  },
  {
    "id": "order-24",
    "cost": [
      2,
      2,
      0,
      2
    ],
    "points": 15
  },
  {
    "id": "order-25",
    "cost": [
      1,
      3,
      1,
      1
    ],
    "points": 16
  },
  {
    "id": "order-26",
    "cost": [
      0,
      2,
      0,
      3
    ],
    "points": 16
  },
  {
    "id": "order-27",
    "cost": [
      2,
      0,
      2,
      0
    ],
    "points": 8
  },
  {
    "id": "order-28",
    "cost": [
      0,
      0,
      2,
      3
    ],
    "points": 18
  },
  {
    "id": "order-29",
    "cost": [
      0,
      4,
      0,
      0
    ],
    "points": 8
  },
  {
    "id": "order-30",
    "cost": [
      0,
      5,
      0,
      0
    ],
    "points": 10
  },
  {
    "id": "order-31",
    "cost": [
      3,
      2,
      0,
      0
    ],
    "points": 7
  },
  {
    "id": "order-32",
    "cost": [
      2,
      1,
      0,
      1
    ],
    "points": 9
  },
  {
    "id": "order-33",
    "cost": [
      0,
      0,
      5,
      0
    ],
    "points": 15
  },
  {
    "id": "order-34",
    "cost": [
      0,
      2,
      2,
      0
    ],
    "points": 10
  },
  {
    "id": "order-35",
    "cost": [
      0,
      0,
      0,
      4
    ],
    "points": 16
  }
];
