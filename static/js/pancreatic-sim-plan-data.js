const PANCREATIC_SIM_PLAN_ROWS = [
  {
    "index": "1",
    "categoryIndex": "1",
    "category": "架構",
    "name": [
      "Channels",
      "(輸入通道數)"
    ],
    "defaultValue": "3",
    "current": "3",
    "adjustments": [],
    "description": "彩色影像的 RGB 通道數。若是單通道的灰階影像（如特定醫療影像），需調整為 1。"
  },
  {
    "index": "2",
    "categoryIndex": "2",
    "category": "架構",
    "name": [
      "Out Channels",
      "(輸出通道數)"
    ],
    "defaultValue": "96",
    "current": "64",
    "adjustments": [],
    "description": "決定第一層卷積萃取出的特徵圖數量 。數值越大能捕捉越多初始特徵，但會增加計算量。"
  },
  {
    "index": "3",
    "categoryIndex": "3",
    "category": "架構",
    "name": [
      "Kernel Size",
      "(卷積核大小)"
    ],
    "defaultValue": "7x7",
    "current": "3x3",
    "adjustments": [],
    "description": "較大的卷積核用於初步大範圍的邊緣與紋理特徵萃取 。"
  },
  {
    "index": "4",
    "categoryIndex": "4",
    "category": "架構",
    "name": [
      "Stride",
      "(步幅)"
    ],
    "defaultValue": "2",
    "current": "2",
    "adjustments": [],
    "description": "決定卷積滑動的距離，步幅為 2 可在網路極前端就將特徵圖空間解析度減半 。"
  },
  {
    "index": "5",
    "categoryIndex": "5",
    "category": "架構",
    "name": [
      "Kernel Size",
      "(卷積核大小)"
    ],
    "defaultValue": "3x3",
    "current": "3x3",
    "adjustments": [],
    "description": "池化視窗的大小 。"
  },
  {
    "index": "6",
    "categoryIndex": "6",
    "category": "架構",
    "name": [
      "Stride",
      "(步幅)"
    ],
    "defaultValue": "2",
    "current": "2",
    "adjustments": [],
    "description": "執行下採樣，將特徵圖長寬再次減半 。"
  },
  {
    "index": "7",
    "categoryIndex": "7",
    "category": "架構",
    "name": [
      "s1x1",
      "(壓縮通道數)"
    ],
    "defaultValue": "分別為：16, 16, 32",
    "current": "16, 16, 32",
    "adjustments": [],
    "description": "Squeeze 層中 1x1 卷積核的數量，目的是在進入 3x3 卷積前強制降維，減少參數量 。"
  },
  {
    "index": "8",
    "categoryIndex": "8",
    "category": "架構",
    "name": [
      "e1x1",
      "(擴展通道數)"
    ],
    "defaultValue": "分別為：64, 64, 128",
    "current": "64, 64, 128",
    "adjustments": [],
    "description": "Expand 層中 1x1 卷積核的數量，用於特徵擴充 。"
  },
  {
    "index": "9",
    "categoryIndex": "9",
    "category": "架構",
    "name": [
      "e3x3",
      "(擴展通道數)"
    ],
    "defaultValue": "分別為：64, 64, 128",
    "current": "64, 64, 128",
    "adjustments": [],
    "description": "Expand 層中 3x3 卷積核的數量，負責捕捉具空間關聯性的特徵 。"
  },
  {
    "index": "10",
    "categoryIndex": "10",
    "category": "架構",
    "name": [
      "Kernel Size",
      "(卷積核大小)"
    ],
    "defaultValue": "3x3",
    "current": "3x3",
    "adjustments": [],
    "description": "池化視窗的大小 。"
  },
  {
    "index": "11",
    "categoryIndex": "11",
    "category": "架構",
    "name": [
      "Stride",
      "(步幅)"
    ],
    "defaultValue": "2",
    "current": "2",
    "adjustments": [],
    "description": "延遲降採樣策略的一部分，於中段進一步縮小特徵圖 。"
  },
  {
    "index": "12",
    "categoryIndex": "12",
    "category": "架構",
    "name": [
      "s1x1",
      "(壓縮通道數)"
    ],
    "defaultValue": "分別為：32, 48, 48, 64",
    "current": "32, 48, 48, 64",
    "adjustments": [],
    "description": "隨著網路加深，增加 Squeeze 層的特徵維度保留量 。"
  },
  {
    "index": "13",
    "categoryIndex": "13",
    "category": "架構",
    "name": [
      "e1x1",
      "(擴展通道數)"
    ],
    "defaultValue": "分別為：128, 192, 192, 256",
    "current": "128, 192, 192, 256",
    "adjustments": [],
    "description": "隨著網路加深，增加 1x1 擴展層的通道數以提取更高階抽象特徵 。"
  },
  {
    "index": "14",
    "categoryIndex": "14",
    "category": "架構",
    "name": [
      "e3x3",
      "(擴展通道數)"
    ],
    "defaultValue": "分別為：128, 192, 192, 256",
    "current": "128, 192, 192, 256",
    "adjustments": [],
    "description": "隨著網路加深，增加 3x3 擴展層的通道數 。"
  },
  {
    "index": "15",
    "categoryIndex": "15",
    "category": "架構",
    "name": [
      "Kernel Size",
      "(卷積核大小)"
    ],
    "defaultValue": "3x3",
    "current": "3x3",
    "adjustments": [],
    "description": "池化視窗的大小 。"
  },
  {
    "index": "16",
    "categoryIndex": "16",
    "category": "架構",
    "name": [
      "Stride",
      "(步幅)"
    ],
    "defaultValue": "2",
    "current": "2",
    "adjustments": [],
    "description": "網路深層的最後一次空間維度下採樣 。"
  },
  {
    "index": "17",
    "categoryIndex": "17",
    "category": "架構",
    "name": [
      "s1x1",
      "(壓縮通道數)"
    ],
    "defaultValue": "64",
    "current": "64",
    "adjustments": [],
    "description": "網路最後一個 Fire 模組的壓縮層通道數 。"
  },
  {
    "index": "18",
    "categoryIndex": "18",
    "category": "架構",
    "name": [
      "e1x1",
      "(擴展通道數)"
    ],
    "defaultValue": "256",
    "current": "256",
    "adjustments": [],
    "description": "網路最後一個 Fire 模組的 1x1 擴展層通道數 。"
  },
  {
    "index": "19",
    "categoryIndex": "19",
    "category": "架構",
    "name": [
      "e3x3",
      "(擴展通道數)"
    ],
    "defaultValue": "256",
    "current": "256",
    "adjustments": [],
    "description": "網路最後一個 Fire 模組的 3x3 擴展層通道數 。"
  },
  {
    "index": "20",
    "categoryIndex": "20",
    "category": "架構",
    "name": [
      "Dropout Ratio",
      "(丟棄率)"
    ],
    "defaultValue": "0.5",
    "current": "0.6",
    "adjustments": [
      "0.5",
      "0.4"
    ],
    "description": "在進入最後的分類器前，隨機關閉 50% 的神經元連接，防止模型過擬合 。"
  },
  {
    "index": "21",
    "categoryIndex": "21",
    "category": "架構",
    "name": [
      "Out Channels",
      "(輸出通道數)"
    ],
    "defaultValue": "1000",
    "current": "2",
    "adjustments": [],
    "description": "SqueezeNet 放棄了全連接層，此層的卷積核數量直接等同於目標任務的「類別數量」（如 ImageNet 是 1000 類，您的任務需改為目標類別數） 。"
  },
  {
    "index": "22",
    "categoryIndex": "22",
    "category": "架構",
    "name": [
      "Kernel Size",
      "(卷積核大小)"
    ],
    "defaultValue": "1x1",
    "current": "1x1",
    "adjustments": [],
    "description": "用於統合深層特徵，將其映射到對應的類別維度上 。"
  },
  {
    "index": "23",
    "categoryIndex": "23",
    "category": "架構",
    "name": [
      "Stride (步幅)"
    ],
    "defaultValue": "1",
    "current": "1",
    "adjustments": [],
    "description": "保持特徵圖大小不變 。"
  },
  {
    "index": "24",
    "categoryIndex": "24",
    "category": "架構",
    "name": [
      "Output Size",
      "(輸出尺寸)"
    ],
    "defaultValue": "1x1",
    "current": "1x1",
    "adjustments": [],
    "description": "對每張特徵圖的所有像素計算平均值，將空間維度（預設為 13x13）徹底壓縮為單一數值 。"
  },
  {
    "index": "25",
    "categoryIndex": "25",
    "category": "架構",
    "name": [
      "Dimension",
      "(運算維度)"
    ],
    "defaultValue": "1",
    "current": "1",
    "adjustments": [],
    "description": "將網路最終輸出的原始數值轉換為機率分佈（總和為 1），以輸出最終的預測結果 。"
  },
  {
    "index": "26",
    "categoryIndex": "26",
    "category": "架構",
    "name": [
      "pretrained",
      "(預訓練權重)",
      "(額外增加)"
    ],
    "defaultValue": "False",
    "current": "True",
    "adjustments": [],
    "description": "是否載入 ImageNet 預訓練權重作為初始參數。"
  },
  {
    "index": "27",
    "categoryIndex": "1",
    "category": "優化",
    "name": [
      "InitialLearnRate",
      "(初始學習率)"
    ],
    "defaultValue": "0.001",
    "current": "0.0001",
    "adjustments": [],
    "description": "決定參數更新的步長。若過低訓練會太久，過高可能導致結果次佳或發散。"
  },
  {
    "index": "28",
    "categoryIndex": "2",
    "category": "優化",
    "name": [
      "LearnRateSchedule",
      "(學習率排程)"
    ],
    "defaultValue": "\"none\"",
    "current": "cosine",
    "adjustments": [],
    "description": "訓練深層網路時常設為 \"piecewise\"（分段下降），或新版支援的 \"warmup\", \"cosine\" 等，讓模型後期縮小步長以精準收斂。"
  },
  {
    "index": "29",
    "categoryIndex": "3",
    "category": "優化",
    "name": [
      "LearnRateDropFactor",
      "(學習率下降因子)"
    ],
    "defaultValue": "0.1",
    "current": "不使用",
    "adjustments": [],
    "description": "當排程包含 \"piecewise\" 時生效，學習率觸發下降時乘上的數值。"
  },
  {
    "index": "30",
    "categoryIndex": "4",
    "category": "優化",
    "name": [
      "LearnRateDropPeriod",
      "(學習率下降週期)"
    ],
    "defaultValue": "10",
    "current": "不使用",
    "adjustments": [],
    "description": "當排程為 \"piecewise\" 時，每經過多少 Epochs 執行一次下降。"
  },
  {
    "index": "31",
    "categoryIndex": "5",
    "category": "優化",
    "name": [
      "L2Regularization",
      "(L2 正規化因子 (權重衰減))"
    ],
    "defaultValue": "0.0001",
    "current": "0.001",
    "adjustments": [
      "0.0005",
      "0.0001"
    ],
    "description": "用於在損失函數中加入權重懲罰，以減少過擬合。"
  },
  {
    "index": "32",
    "categoryIndex": "6",
    "category": "優化",
    "name": [
      "GradientThreshold",
      "(梯度裁剪閾值)"
    ],
    "defaultValue": "Inf",
    "current": "Inf",
    "adjustments": [],
    "description": "建議：若遇到梯度爆炸（Loss 變成 NaN 或 Inf 導致發散），強烈建議將此值設定為正純量進行裁剪以穩定訓練。"
  },
  {
    "index": "33",
    "categoryIndex": "7",
    "category": "優化",
    "name": [
      "GradientThresholdMethod",
      "(梯度裁剪方法)"
    ],
    "defaultValue": "\"l2norm\"",
    "current": "l2norm",
    "adjustments": [],
    "description": "可選 \"l2norm\"、\"global-l2norm\" 或 \"absolute-value\"。"
  },
  {
    "index": "34",
    "categoryIndex": "8",
    "category": "優化",
    "name": [
      "GradientDecayFactor",
      "(梯度移動平均衰減率)"
    ],
    "defaultValue": "0.9",
    "current": "0.9",
    "adjustments": [],
    "description": "僅 Adam 適用，控制動量項的貢獻程度。"
  },
  {
    "index": "35",
    "categoryIndex": "9",
    "category": "優化",
    "name": [
      "SquaredGradientDecayFactor",
      "(梯度平方移動平均衰減率)"
    ],
    "defaultValue": "0.999",
    "current": "0.999",
    "adjustments": [],
    "description": "Adam 與 RMSprop 適用。建議：常用值為 0.9、0.99、0.999"
  },
  {
    "index": "36",
    "categoryIndex": "10",
    "category": "優化",
    "name": [
      "Epsilon",
      "(分母偏移量)"
    ],
    "defaultValue": "1e-8",
    "current": "1e-8",
    "adjustments": [],
    "description": "加在參數更新的分母中以避免除以零。建議：預設值適用於大多數任務。"
  },
  {
    "index": "37",
    "categoryIndex": "11",
    "category": "優化",
    "name": [
      "min_learning_rate",
      "(Cosine 學習率下限)",
      "(額外增加)"
    ],
    "defaultValue": "0",
    "current": "1e-6",
    "adjustments": [],
    "description": "CosineAnnealingLR 的 eta_min，避免最後幾個 epoch 的學習率降到 0。"
  },
  {
    "index": "38",
    "categoryIndex": "12",
    "category": "優化",
    "name": [
      "finetune_learning_rate",
      "(解凍後微調學習率)",
      "(額外增加)"
    ],
    "defaultValue": "1e-4",
    "current": "1e-5",
    "adjustments": [
      "5e-6",
      "3e-5"
    ],
    "description": "凍結期結束、特徵層解凍後，重新建立優化器所使用的學習率。"
  },
  {
    "index": "39",
    "categoryIndex": "13",
    "category": "優化",
    "name": [
      "label_smoothing",
      "(標籤平滑)",
      "(額外增加)"
    ],
    "defaultValue": "0",
    "current": "0.012",
    "adjustments": [],
    "description": "CrossEntropyLoss 的 label smoothing，讓目標標籤不要完全是 0 或 1。"
  },
  {
    "index": "40",
    "categoryIndex": "1",
    "category": "資料",
    "name": [
      "Resolution (影像解析度)"
    ],
    "defaultValue": "224x224",
    "current": "512x512",
    "adjustments": [],
    "description": "網路接收的輸入影像長寬尺寸。"
  },
  {
    "index": "41",
    "categoryIndex": "2",
    "category": "資料",
    "name": [
      "MiniBatchSize",
      "(小批量大小)"
    ],
    "defaultValue": "128",
    "current": "32",
    "adjustments": [],
    "description": "每次迭代用於評估梯度的樣本數。"
  },
  {
    "index": "42",
    "categoryIndex": "3",
    "category": "資料",
    "name": [
      "Data Splitting",
      "(資料切分)"
    ],
    "defaultValue": "80/0/20",
    "current": "80/0/20",
    "adjustments": [],
    "description": "將數據分為訓練、驗證與測試集的過程，用以訓練模型並客觀評估其泛化能力。"
  },
  {
    "index": "43",
    "categoryIndex": "4",
    "category": "資料",
    "name": [
      "Shuffle",
      "(數據打亂選項)"
    ],
    "defaultValue": "\"once\"",
    "current": "every-epoch",
    "adjustments": [],
    "description": "若 MiniBatchSize 無法整除訓練樣本，預設會丟棄最後不完整的批量"
  },
  {
    "index": "44",
    "categoryIndex": "5",
    "category": "資料",
    "name": [
      "use_augmentation",
      "(資料增強)",
      "(額外增加)"
    ],
    "defaultValue": "False",
    "current": "False",
    "adjustments": [],
    "description": "訓練階段是否套用資料增強。此實驗關閉。"
  },
  {
    "index": "45",
    "categoryIndex": "6",
    "category": "資料",
    "name": [
      "crop_padding",
      "(ROI 外擴像素)",
      "(額外增加)"
    ],
    "defaultValue": "0",
    "current": "48",
    "adjustments": [],
    "description": "只對訓練圖，沿非零 ROI 向外再留的像素數。測試集維持原圖、不裁切。"
  },
  {
    "index": "46",
    "categoryIndex": "1",
    "category": "訓練",
    "name": [
      "MaxEpochs",
      "(最大訓練輪數)"
    ],
    "defaultValue": "30",
    "current": "30",
    "adjustments": [],
    "description": "演算法完整通過整個訓練資料集的次數。"
  },
  {
    "index": "47",
    "categoryIndex": "2",
    "category": "訓練",
    "name": [
      "ValidationPatience",
      "(早停耐心值)"
    ],
    "defaultValue": "Inf",
    "current": "Inf",
    "adjustments": [],
    "description": "容忍驗證指標不再改善的次數。建議：設為一個正整數（如 5），當模型在驗證集上停止進步時自動停止訓練，這是防止過擬合的極佳機制。"
  },
  {
    "index": "48",
    "categoryIndex": "3",
    "category": "訓練",
    "name": [
      "freeze_epochs",
      "(凍結特徵層輪數)",
      "(額外增加)"
    ],
    "defaultValue": "0",
    "current": "5",
    "adjustments": [
      "3",
      "8"
    ],
    "description": "前 N 個 epoch 凍結預訓練特徵層，只訓練分類器。設為 0 代表不凍結。"
  }
];
