// Own parts – what parts-reviews.js and own-chip-savings.js read from the game (1.6.0): the columns a released
// model keeps its chip and OS in (the game writes them from these designer variables on release), how the designer
// finds an own chip, the OS lists and licences, the own OS records and the designer texts the ratings show next to.
(() => {
  const PHONE_CHIP = { 44: 'ProcessorType', 45: 'ProcessorID', 46: 'ProcessorSeriesID', 47: 'ProcessorRefreshRateID',
    48: 'ProcessorCoresID', 49: 'ProcessorTechprocessID', 50: 'ProcessorCasheMemoryID', 51: 'GraphicProcessorType',
    52: 'GraphicProcessorID', 53: 'GraphicProcessorSeriesID', 54: 'GraphicProcessorRefreshRateID',
    55: 'GraphicProcessor_ProcessingPowerID', 56: 'GraphicProcessor_TextureFillRateID', 57: 'GraphicProcessor_PixelFillrateID' };
  const PHONE_OS = { 64: 'OperationSystemID', 65: 'OperationSystem_Text', 66: 'OperationSystemVersion_Text' };
  // an own chip: the designer finds a phone's by its id unless its list (Temp) is filled, a laptop's by the cursors of
  // its series and model (1-based, the chips of each series in array order)
  const PHONE_OWN = { ownValue: 2, typeCol: 44, find: { chips: 'ArrayMyCPU_Smartphones', temp: 'ArrayProcessorsSeries_Temp', idVar: 'ProcessorSeriesID' } };
  const NO_OWN = (typeCol) => ({ typeCol, ownValue: null });
  const engines = {
    ReviewsEngine_Smartphones: {
      chip: { type: 'SMARTPHONE', scoreFn: 'computeSpecScores', group: 'mobile', cpu: PHONE_OWN, cols: PHONE_CHIP },
      os: { family: 'mobile', cols: PHONE_OS },
    },
    ReviewsEngine_Tablets: {
      chip: { type: 'TABLET', scoreFn: 'computeTabletSpecScores', group: 'mobile', cpu: PHONE_OWN, cols: PHONE_CHIP },
      os: { family: 'mobile', cols: PHONE_OS },
    },
    ReviewsEngine_Laptops: {
      chip: { type: 'LAPTOP', scoreFn: 'computeLaptopSpecScores', group: 'laptop', gpuBars: 'getLaptopChipSpecBars',
        cpu: { typeCol: 22, ownValue: 2, find: { chips: 'ArrayMyCPU_Laptops', series: 'ArrayMyCPU_LaptopsSeries', cursors: ['ProcessorSeries', 'ProcessorModel'], idVar: 'ProcessorSeriesID' } },
        // GraphicProcessorType: 0 the CPU's graphics, 1 custom integrated, 2 a card, 3 a custom card, 4 an own card
        gpu: { typeCol: 30, ownValue: 4, find: { chips: 'ArrayMyGPU_Laptops', series: 'ArrayMyGPU_LaptopsSeries', cursors: ['GraphicProcessorSeries', 'GraphicProcessorModel'], idVar: 'GraphicProcessorSeriesID' } },
        cols: { 22: 'ProcessorType', 23: 'ProcessorID', 24: 'ProcessorSeriesID', 25: 'ProcessorModelID', 26: 'ProcessorRefreshRateID',
          27: 'ProcessorCoresID', 28: 'ProcessorTechprocessID', 29: 'ProcessorCasheMemoryID', 30: 'GraphicProcessorType',
          31: 'GraphicProcessorID', 32: 'GraphicProcessorSeriesID', 33: 'GraphicProcessorModelID', 34: 'GraphicProcessorRefreshRateID',
          35: 'GraphicProcessor_ProcessingPowerID', 36: 'GraphicProcessor_TextureUnitsID', 37: 'GraphicProcessor_VRAMID',
          38: 'GraphicProcessor_TextureFillRateID' } },
      os: { family: 'laptop', cols: { 49: 'OperationSystemID', 50: 'OperationSystem_Text', 51: 'OperationSystemVersion_Text' } },
    },
    ReviewsEngine_Watches: {
      chip: { type: 'WATCHES', scoreFn: 'computeWatchesSpecScores', group: 'mobile', cpu: NO_OWN(21),
        cols: { 21: 'ProcessorType', 22: 'ProcessorID', 23: 'ProcessorSeriesID', 24: 'ProcessorRefreshRateID', 25: 'ProcessorCoresID',
          26: 'ProcessorTechprocessID', 27: 'ProcessorCasheMemoryID', 28: 'GraphicProcessorType', 29: 'GraphicProcessorID',
          30: 'GraphicProcessorSeriesID', 31: 'GraphicProcessorRefreshRateID' } },
      os: { family: 'watches', cols: { 37: 'OperationSystemID', 38: 'OperationSystem_Text', 39: 'OperationSystemVersion_Text' } },
    },
    ReviewsEngine_Headphones: {
      chip: { type: 'HEADPHONES', scoreFn: 'computeHeadphonesSpecScores', group: 'other', cpu: NO_OWN(26),
        cols: { 26: 'ProcessorType', 27: 'ProcessorID', 28: 'ProcessorSeriesID', 29: 'ProcessorDspPerformanceID',
          30: 'ProcessorFrequencyRangeID', 31: 'ProcessorMicrophoneLevelID', 32: 'ProcessorLatencyLevelID' } },
    },
    ReviewsEngine_TV: {
      chip: { type: 'TV', scoreFn: 'computeTVSpecScores', group: 'other', cpu: NO_OWN(21),
        cols: { 21: 'ProcessorType', 22: 'ProcessorID', 23: 'ProcessorSeriesID', 24: 'ProcessorRefreshRateID', 25: 'ProcessorCoresID',
          26: 'ProcessorFrameProcessingLatencyID', 27: 'ProcessorInputLagID', 28: 'ProcessorAIComputePowerID', 29: 'GraphicProcessorType',
          30: 'GraphicProcessorID', 31: 'GraphicProcessorSeriesID', 32: 'GraphicProcessorRefreshRateID', 39: 'ProcessorMaxBittrateSupportID' } },
      os: { family: 'tv', cols: { 41: 'OperationSystemID', 42: 'OperationSystem_Text', 43: 'OperationSystemVersion_Text' } },
    },
    ReviewsEngine_Scooter: {
      chip: { type: 'SCOOTER', scoreFn: 'computeScooterSpecScores', group: 'other', cpu: NO_OWN(33),
        cols: { 33: 'ProcessorType', 34: 'ProcessorID', 35: 'ProcessorSeriesID', 36: 'ProcessorRefreshRateID', 37: 'ProcessorCoresID',
          38: 'ProcessorMotorControlResolutionID', 39: 'ProcessorSensorLatencyID', 40: 'ProcessorSensorBandwidthID', 41: 'ProcessorMotorControlFrequencyID' } },
    },
    ReviewsEngine_Keyboards: {
      chip: { type: 'KEYBOARD', scoreFn: 'computeKeyboardSpecScores', group: 'other', cpu: NO_OWN(19),
        cols: { 19: 'ProcessorType', 20: 'ProcessorID', 21: 'ProcessorSeriesID', 22: 'ProcessorRefreshRateID', 23: 'ProcessorKeyScanRateID',
          24: 'ProcessorSRAMID', 25: 'ProcessorInputLatencyID', 26: 'ProcessorFlashMemoryID', 27: 'ProcessorKeyThroughputID' } },
    },
    // consoles and VR: the designer takes the own chip from getMyConsoleCpuInfo / getMyVRCpuInfo
    ReviewsEngine_Consoles: {
      chip: { type: 'CONSOLE', scoreFn: 'computeConsoleSpecScores', group: 'console', cpu: { typeCol: 29, ownValue: 2 },
        cols: { 29: 'ProcessorType', 30: 'ProcessorID', 31: 'ProcessorSeriesID', 32: 'ProcessorModelID', 33: 'ProcessorRefreshRateID',
          34: 'ProcessorCoresID', 35: 'ProcessorTechprocessID', 36: 'ProcessorCasheMemoryID', 37: 'GraphicProcessorType',
          38: 'GraphicProcessorID', 39: 'GraphicProcessorSeriesID', 40: 'GraphicProcessorModelID', 41: 'GraphicProcessorRefreshRateID',
          42: 'GraphicProcessor_ProcessingPowerID', 43: 'GraphicProcessor_TextureUnitsID', 44: 'GraphicProcessor_TextureFillRateID' } },
    },
    ReviewsEngine_VR: {
      chip: { type: 'VR', scoreFn: 'computeVRSpecScores', group: 'console', cpu: { typeCol: 29, ownValue: 2 },
        cols: { 29: 'ProcessorType', 30: 'ProcessorID', 31: 'ProcessorSeriesID', 32: 'ProcessorModelID', 33: 'ProcessorRefreshRateID',
          34: 'ProcessorCoresID', 35: 'ProcessorTechprocessID', 36: 'ProcessorCasheMemoryID', 37: 'GraphicProcessorType',
          38: 'GraphicProcessorID', 39: 'GraphicProcessorModelID', 40: 'GraphicProcessorRefreshRateID',
          41: 'GraphicProcessor_ProcessingPowerID', 42: 'GraphicProcessor_TextureFillRateID', 43: 'GraphicProcessor_PixelFillrateID' } },
    },
  };
  // the OS lists of the market (x = entry, fields on y): family id (also the licence key), version, release day, last
  // day of support, the entry's id (what OperationSystemID holds), name; own: the player's OS of that family (x = released version, the newest first)
  const OS = (name) => ({ id: 0, version: 1, start: 2, end: 3, row: 4, name });
  const osArrays = {
    mobile: { array: 'ArrayOperationSystem_Smartphone', own: 'ArrayMyOS_SmartphonesEarnings', fields: OS(5) },
    laptop: { array: 'ArrayOperationSystem_Laptop', own: 'ArrayMyOS_LaptopsEarnings', fields: OS(7) },
    watches: { array: 'ArrayOperationSystem_Watches', own: 'ArrayMyOS_WatchesEarnings', fields: OS(5) },
    tv: { array: 'ArrayOperationSystem_TV', own: 'ArrayMyOS_TVEarnings', fields: OS(5) },
  };
  // licences: family id, valid until, price (0: free)
  const license = { array: 'ArrayOperationSystem_License', fields: { id: 0, expiry: 1, price: 2 } };
  const ownOs = { fields: { name: 0, version: 1, license: 3, rating: 7, release: 8 }, privateValue: 'PRIVATE' };
  // the arrays the game keeps the production cost of own chips in (x = chip, y = 0, z = OWN_COST_Z) and the getters
  // of the chip cost configs (TYPE_MULT: stock, custom, own)
  const ownChipEarnings = {
    SMARTPHONE: { cpu: 'ArrayMyCPU_SmartphonesEarnings' }, TABLET: { cpu: 'ArrayMyCPU_SmartphonesEarnings' },
    LAPTOP: { cpu: 'ArrayMyCPU_LaptopsEarnings', gpu: 'ArrayMyGPU_LaptopsEarnings' },
    CONSOLE: { cpu: 'ArrayMyCPU_ConsolesEarnings' }, VR: { cpu: 'ArrayMyCPU_VREarnings' },
  };
  const chipConfig = { SMARTPHONE: 'getChipCostConfig', TABLET: 'getChipCostConfig', LAPTOP: 'getLaptopChipCostConfig',
    CONSOLE: 'getConsoleChipCostConfig', VR: 'getVRChipCostConfig' };
  // designer texts: the chosen OS name (OS page), the chosen chip series (chip page), the production cost (price page)
  const uids = {
    os: { ReviewsEngine_Smartphones: 1135, ReviewsEngine_Tablets: 2228, ReviewsEngine_Laptops: 3039, ReviewsEngine_Watches: 3625, ReviewsEngine_TV: 4563 },
    chip: { ReviewsEngine_Smartphones: 1040, ReviewsEngine_Tablets: 2140, ReviewsEngine_Laptops: 2909, ReviewsEngine_Consoles: 12093 },
    gpu: { ReviewsEngine_Laptops: 2947 },
    price: 1392,
  };
  globalThis.BDTPartsData = Object.freeze({ engines, osArrays, license, ownOs, ownChipEarnings, chipConfig, uids, OWN_COST_Z: 3 });
})();
