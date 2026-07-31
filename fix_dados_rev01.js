// fix_dados_rev01.js
// Reconstrói os Grupos 2 e 3 do public/dados.json conforme Orçamento Rev 01
// (aço e forma desmembrados; itens "Apenas Material" com h:0; Hh das execuções reescalado)
// Uso: colocar na raiz do projeto -> node fix_dados_rev01.js
const fs = require('fs');
const path = require('path');

const p = path.join(process.cwd(), 'public', 'dados.json');
const data = JSON.parse(fs.readFileSync(p, 'utf8'));

// backup de segurança
fs.writeFileSync(p + '.bak', JSON.stringify(data));

// remove os itens antigos dos grupos 2 e 3
const mantidos = data.filter(d => d.g !== 2 && d.g !== 3);

// novos itens Rev 01 (Grupos 2 e 3)
const novos = [
  {
    "g": 2,
    "n": "MOVIMENTO DE TERRA E FUNDAÇÕES",
    "p": "1º",
    "i": "2.1.1",
    "d": "Escavação Mecanizada - Terraplanagem",
    "q": 17,
    "c": 8500,
    "h": 17.0,
    "a": 1,
    "b": 1
  },
  {
    "g": 2,
    "n": "MOVIMENTO DE TERRA E FUNDAÇÕES",
    "p": "1º",
    "i": "2.1.2",
    "d": "Caminhão de Terra",
    "q": 13,
    "c": 6500,
    "h": 0.0,
    "a": 1,
    "b": 1
  },
  {
    "g": 2,
    "n": "MOVIMENTO DE TERRA E FUNDAÇÕES",
    "p": "1º",
    "i": "2.1.3",
    "d": "Retroescavadeira - Movimentação de Terra da Helice",
    "q": 6,
    "c": 8400,
    "h": 0.7,
    "a": 1,
    "b": 1
  },
  {
    "g": 2,
    "n": "MOVIMENTO DE TERRA E FUNDAÇÕES",
    "p": "1º",
    "i": "2.1.4",
    "d": "Estaca hélice contínua ø40 cm  e 50 cm",
    "q": 336,
    "c": 52351.43,
    "h": 223.8,
    "a": 1,
    "b": 1
  },
  {
    "g": 2,
    "n": "MOVIMENTO DE TERRA E FUNDAÇÕES",
    "p": "1º",
    "i": "2.1.5",
    "d": "Concreto usinado fck 25 MPa estrutural, bombeado, slump 100±20",
    "q": 67.5,
    "c": 36450,
    "h": 0.0,
    "a": 1,
    "b": 1
  },
  {
    "g": 2,
    "n": "MOVIMENTO DE TERRA E FUNDAÇÕES",
    "p": "1º",
    "i": "2.1.6",
    "d": "Aço Estaca - Comprado pronto",
    "q": 1,
    "c": 21660.12,
    "h": 5.5,
    "a": 1,
    "b": 1
  },
  {
    "g": 2,
    "n": "MOVIMENTO DE TERRA E FUNDAÇÕES",
    "p": "1º",
    "i": "2.1.7",
    "d": "Arrasamento de estacas",
    "q": 52,
    "c": 8320,
    "h": 114.4,
    "a": 1,
    "b": 2
  },
  {
    "g": 2,
    "n": "MOVIMENTO DE TERRA E FUNDAÇÕES",
    "p": "1º",
    "i": "2.1.8",
    "d": "Escavação manual em material 1ª categoria (até 1,50 m)",
    "q": 81.075,
    "c": 14593.5,
    "h": 283.8,
    "a": 1,
    "b": 2
  },
  {
    "g": 2,
    "n": "MOVIMENTO DE TERRA E FUNDAÇÕES",
    "p": "1º",
    "i": "2.1.9",
    "d": "Bloco de coroamento concreto armado fck 25 MPa",
    "q": 33.31,
    "c": 28714.78,
    "h": 10.0,
    "a": 2,
    "b": 2
  },
  {
    "g": 2,
    "n": "MOVIMENTO DE TERRA E FUNDAÇÕES",
    "p": "1º",
    "i": "2.1.10",
    "d": "Viga baldrame de concreto armado fck 25 MPa, seção 20×40 cm",
    "q": 20.74,
    "c": 20765.77,
    "h": 8.3,
    "a": 2,
    "b": 2
  },
  {
    "g": 2,
    "n": "MOVIMENTO DE TERRA E FUNDAÇÕES",
    "p": "1º",
    "i": "2.1.11",
    "d": "Lastro de concreto magro fck 10 MPa, e=5 cm",
    "q": 170,
    "c": 7259.0,
    "h": 67.3,
    "a": 2,
    "b": 2
  },
  {
    "g": 2,
    "n": "MOVIMENTO DE TERRA E FUNDAÇÕES",
    "p": "1º",
    "i": "2.1.12",
    "d": "Impermeabilização baldrame com emulsão asfáltica (2 demãos)",
    "q": 64,
    "c": 1312,
    "h": 21.4,
    "a": 2,
    "b": 2
  },
  {
    "g": 2,
    "n": "MOVIMENTO DE TERRA E FUNDAÇÕES",
    "p": "1º",
    "i": "2.1.13",
    "d": "Material Forma - (Apenas Material) - 3 Utililizações - Bloco e Vigas",
    "q": 94.36,
    "c": 3491.32,
    "h": 0,
    "a": 1,
    "b": 1
  },
  {
    "g": 2,
    "n": "MOVIMENTO DE TERRA E FUNDAÇÕES",
    "p": "1º",
    "i": "2.1.14",
    "d": "Aço Blocos e Vigas - (Apenas Material) - Bloco e Viga",
    "q": 3218.177,
    "c": 21658.33,
    "h": 0,
    "a": 1,
    "b": 1
  },
  {
    "g": 3,
    "n": "ESTRUTURA (CONCRETO, FORMAS, ARMAÇÃO)",
    "p": "1º",
    "i": "3.1.1",
    "d": "Armação aço CA-50 incl. corte, dobra, montagem e perdas",
    "q": 1144.08,
    "c": 5720.4,
    "h": 205.9,
    "a": 1,
    "b": 2
  },
  {
    "g": 3,
    "n": "ESTRUTURA (CONCRETO, FORMAS, ARMAÇÃO)",
    "p": "1º",
    "i": "3.1.2",
    "d": "Concreto usinado fck 25 MPa estrutural, bombeado, slump 100±20",
    "q": 14.301,
    "c": 6481.21,
    "h": 17.2,
    "a": 3,
    "b": 3
  },
  {
    "g": 3,
    "n": "ESTRUTURA (CONCRETO, FORMAS, ARMAÇÃO)",
    "p": "1º",
    "i": "3.1.3",
    "d": "Lançamento, adensamento e acabamento de concreto estrutural",
    "q": 14.301,
    "c": 350.37,
    "h": 78.7,
    "a": 3,
    "b": 3
  },
  {
    "g": 3,
    "n": "ESTRUTURA (CONCRETO, FORMAS, ARMAÇÃO)",
    "p": "1º",
    "i": "3.1.4",
    "d": "Forma de chapa compensada plastificada 18 mm, 4 utilizações",
    "q": 138.831,
    "c": 8885.18,
    "h": 312.4,
    "a": 2,
    "b": 3
  },
  {
    "g": 3,
    "n": "ESTRUTURA (CONCRETO, FORMAS, ARMAÇÃO)",
    "p": "1º",
    "i": "3.1.5",
    "d": "Execução Escadas",
    "q": 9,
    "c": 8847,
    "h": 261.1,
    "a": 6,
    "b": 6
  },
  {
    "g": 3,
    "n": "ESTRUTURA (CONCRETO, FORMAS, ARMAÇÃO)",
    "p": "1º",
    "i": "3.1.6",
    "d": "Material Forma - (Apenas Material) - 3 Utililizações - Pilares- Escada 1ºPAV",
    "q": 184.955,
    "c": 3780.48,
    "h": 0,
    "a": 2,
    "b": 3
  },
  {
    "g": 3,
    "n": "ESTRUTURA (CONCRETO, FORMAS, ARMAÇÃO)",
    "p": "1º",
    "i": "3.1.7",
    "d": "Aço  - (Apenas Material) - Pilares- Escada 1ºPAV",
    "q": 1864.08,
    "c": 12116.52,
    "h": 0,
    "a": 2,
    "b": 3
  },
  {
    "g": 3,
    "n": "ESTRUTURA (CONCRETO, FORMAS, ARMAÇÃO)",
    "p": "2º",
    "i": "3.2.1",
    "d": "Armação aço CA-50 incl. corte, dobra, montagem e perdas",
    "q": 7109.445,
    "c": 35547.22,
    "h": 1279.7,
    "a": 3,
    "b": 3
  },
  {
    "g": 3,
    "n": "ESTRUTURA (CONCRETO, FORMAS, ARMAÇÃO)",
    "p": "2º",
    "i": "3.2.2",
    "d": "Concreto usinado fck 25 MPa estrutural, bombeado, slump 100±20",
    "q": 63.074,
    "c": 28584.91,
    "h": 75.7,
    "a": 4,
    "b": 6
  },
  {
    "g": 3,
    "n": "ESTRUTURA (CONCRETO, FORMAS, ARMAÇÃO)",
    "p": "2º",
    "i": "3.2.3",
    "d": "Lançamento, adensamento e acabamento de concreto estrutural",
    "q": 63.074,
    "c": 1545.3,
    "h": 346.9,
    "a": 4,
    "b": 6
  },
  {
    "g": 3,
    "n": "ESTRUTURA (CONCRETO, FORMAS, ARMAÇÃO)",
    "p": "2º",
    "i": "3.2.4",
    "d": "Forma de chapa compensada plastificada 18 mm, 4 utilizações",
    "q": 596.537,
    "c": 38178.34,
    "h": 1342.2,
    "a": 3,
    "b": 6
  },
  {
    "g": 3,
    "n": "ESTRUTURA (CONCRETO, FORMAS, ARMAÇÃO)",
    "p": "2º",
    "i": "3.2.5",
    "d": "Execução Escadas",
    "q": 9,
    "c": 8487,
    "h": 261.1,
    "a": 6,
    "b": 6
  },
  {
    "g": 3,
    "n": "ESTRUTURA (CONCRETO, FORMAS, ARMAÇÃO)",
    "p": "2º",
    "i": "3.2.6",
    "d": "Material Forma - (Apenas Material) - 3 Utililizações - Vigas-Pilares-Lajes 2ºPAV",
    "q": 1350,
    "c": 27594,
    "h": 0,
    "a": 3,
    "b": 6
  },
  {
    "g": 3,
    "n": "ESTRUTURA (CONCRETO, FORMAS, ARMAÇÃO)",
    "p": "2º",
    "i": "3.2.7",
    "d": "Aço  - (Apenas Material) - Vigas-Pilares-Lajes 2ºPAV",
    "q": 7829.45,
    "c": 50891.42,
    "h": 0,
    "a": 3,
    "b": 6
  },
  {
    "g": 3,
    "n": "ESTRUTURA (CONCRETO, FORMAS, ARMAÇÃO)",
    "p": "3º",
    "i": "3.3.1",
    "d": "Armação aço CA-50 incl. corte, dobra, montagem e perdas - Apenas MO",
    "q": 2237.55,
    "c": 11187.75,
    "h": 402.8,
    "a": 5,
    "b": 6
  },
  {
    "g": 3,
    "n": "ESTRUTURA (CONCRETO, FORMAS, ARMAÇÃO)",
    "p": "3º",
    "i": "3.3.2",
    "d": "Concreto usinado fck 25 MPa estrutural, bombeado, slump 100±20 - Apenas Material",
    "q": 29.831,
    "c": 13519.18,
    "h": 35.8,
    "a": 4,
    "b": 6
  },
  {
    "g": 3,
    "n": "ESTRUTURA (CONCRETO, FORMAS, ARMAÇÃO)",
    "p": "3º",
    "i": "3.3.3",
    "d": "Lançamento, adensamento e acabamento de concreto estrutural - Apenas MO",
    "q": 29.831,
    "c": 730.85,
    "h": 164.0,
    "a": 4,
    "b": 6
  },
  {
    "g": 3,
    "n": "ESTRUTURA (CONCRETO, FORMAS, ARMAÇÃO)",
    "p": "3º",
    "i": "3.3.5",
    "d": "Forma de chapa compensada plastificada 18 mm, 4 utilizações - Apenas MO",
    "q": 368.298,
    "c": 23571.07,
    "h": 828.7,
    "a": 6,
    "b": 7
  },
  {
    "g": 3,
    "n": "ESTRUTURA (CONCRETO, FORMAS, ARMAÇÃO)",
    "p": "3º",
    "i": "3.3.6",
    "d": "Execução Escadas - Concreto + MO",
    "q": 9,
    "c": 8172,
    "h": 261.1,
    "a": 7,
    "b": 7
  },
  {
    "g": 3,
    "n": "ESTRUTURA (CONCRETO, FORMAS, ARMAÇÃO)",
    "p": "3º",
    "i": "3.3.7",
    "d": "Material Forma - (Apenas Material) - 3 Utililizações - Vigas-Pilares-Lajes 3ºPAV",
    "q": 408.8,
    "c": 8355.87,
    "h": 0,
    "a": 6,
    "b": 7
  },
  {
    "g": 3,
    "n": "ESTRUTURA (CONCRETO, FORMAS, ARMAÇÃO)",
    "p": "3º",
    "i": "3.3.8",
    "d": "Aço  - (Apenas Material) - Vigas-Pilares-Lajes 3ºPAV",
    "q": 2957.55,
    "c": 19224.08,
    "h": 0,
    "a": 6,
    "b": 7
  },
  {
    "g": 3,
    "n": "ESTRUTURA (CONCRETO, FORMAS, ARMAÇÃO)",
    "p": "4º",
    "i": "3.4.1",
    "d": "Armação aço CA-50 incl. corte, dobra, montagem e perdas - Apenas MO",
    "q": 2068.5,
    "c": 10342.5,
    "h": 372.3,
    "a": 7,
    "b": 8
  },
  {
    "g": 3,
    "n": "ESTRUTURA (CONCRETO, FORMAS, ARMAÇÃO)",
    "p": "4º",
    "i": "3.4.2",
    "d": "Concreto usinado fck 25 MPa estrutural, bombeado, slump 100±20 - Apenas Material",
    "q": 28.256,
    "c": 12805.39,
    "h": 33.9,
    "a": 8,
    "b": 9
  },
  {
    "g": 3,
    "n": "ESTRUTURA (CONCRETO, FORMAS, ARMAÇÃO)",
    "p": "4º",
    "i": "3.4.3",
    "d": "Lançamento, adensamento e acabamento de concreto estrutural - Apenas MO",
    "q": 28.256,
    "c": 692.26,
    "h": 155.4,
    "a": 8,
    "b": 10
  },
  {
    "g": 3,
    "n": "ESTRUTURA (CONCRETO, FORMAS, ARMAÇÃO)",
    "p": "4º",
    "i": "3.4.5",
    "d": "Forma de chapa compensada plastificada 18 mm, 4 utilizações - Apenas MO",
    "q": 353.294,
    "c": 22610.78,
    "h": 794.9,
    "a": 8,
    "b": 10
  },
  {
    "g": 3,
    "n": "ESTRUTURA (CONCRETO, FORMAS, ARMAÇÃO)",
    "p": "4º",
    "i": "3.4.6",
    "d": "Execução Escadas - Concreto + MO",
    "q": 9,
    "c": 8172,
    "h": 261.1,
    "a": 9,
    "b": 9
  },
  {
    "g": 3,
    "n": "ESTRUTURA (CONCRETO, FORMAS, ARMAÇÃO)",
    "p": "4º",
    "i": "3.4.7",
    "d": "Material Forma - (Apenas Material) - 3 Utililizações - Vigas-Pilares-Lajes 4ºPAV",
    "q": 393.79,
    "c": 8049.07,
    "h": 0,
    "a": 8,
    "b": 10
  },
  {
    "g": 3,
    "n": "ESTRUTURA (CONCRETO, FORMAS, ARMAÇÃO)",
    "p": "4º",
    "i": "3.4.8",
    "d": "Aço  - (Apenas Material) - Vigas-Pilares-Lajes 4ºPAV",
    "q": 2788.5,
    "c": 18125.25,
    "h": 0,
    "a": 8,
    "b": 10
  },
  {
    "g": 3,
    "n": "ESTRUTURA (CONCRETO, FORMAS, ARMAÇÃO)",
    "p": "5º",
    "i": "3.5.1",
    "d": "Armação aço CA-50 incl. corte, dobra, montagem e perdas - Apenas MO",
    "q": 2330.37,
    "c": 11651.85,
    "h": 419.5,
    "a": 10,
    "b": 10
  },
  {
    "g": 3,
    "n": "ESTRUTURA (CONCRETO, FORMAS, ARMAÇÃO)",
    "p": "5º",
    "i": "3.5.2",
    "d": "Concreto usinado fck 25 MPa estrutural, bombeado, slump 100±20 - Apenas Material",
    "q": 30.786,
    "c": 13952.22,
    "h": 36.9,
    "a": 10,
    "b": 11
  },
  {
    "g": 3,
    "n": "ESTRUTURA (CONCRETO, FORMAS, ARMAÇÃO)",
    "p": "5º",
    "i": "3.5.3",
    "d": "Lançamento, adensamento e acabamento de concreto estrutural - Apenas MO",
    "q": 30.786,
    "c": 754.26,
    "h": 169.3,
    "a": 10,
    "b": 11
  },
  {
    "g": 3,
    "n": "ESTRUTURA (CONCRETO, FORMAS, ARMAÇÃO)",
    "p": "5º",
    "i": "3.5.4",
    "d": "Forma de chapa compensada plastificada 18 mm, 4 utilizações - Apenas MO",
    "q": 369.296,
    "c": 23634.91,
    "h": 830.9,
    "a": 10,
    "b": 11
  },
  {
    "g": 3,
    "n": "ESTRUTURA (CONCRETO, FORMAS, ARMAÇÃO)",
    "p": "5º",
    "i": "3.5.5",
    "d": "Execução Escadas - Concreto + MO",
    "q": 9,
    "c": 8172,
    "h": 261.1,
    "a": 11,
    "b": 11
  },
  {
    "g": 3,
    "n": "ESTRUTURA (CONCRETO, FORMAS, ARMAÇÃO)",
    "p": "5º",
    "i": "3.5.6",
    "d": "Material Forma - (Apenas Material) - 3 Utililizações - Vigas-Pilares-Lajes 5ºPAV",
    "q": 409.796,
    "c": 8376.22,
    "h": 0,
    "a": 10,
    "b": 11
  },
  {
    "g": 3,
    "n": "ESTRUTURA (CONCRETO, FORMAS, ARMAÇÃO)",
    "p": "5º",
    "i": "3.5.7",
    "d": "Aço  - (Apenas Material) - Vigas-Pilares-Lajes 5ºPAV",
    "q": 3050.37,
    "c": 19827.41,
    "h": 0,
    "a": 10,
    "b": 11
  },
  {
    "g": 3,
    "n": "ESTRUTURA (CONCRETO, FORMAS, ARMAÇÃO)",
    "p": "6º/Plat",
    "i": "3.6.1",
    "d": "Armação aço CA-50 incl. corte, dobra, montagem e perdas",
    "q": 2272.2,
    "c": 11361.0,
    "h": 409.0,
    "a": 11,
    "b": 11
  },
  {
    "g": 3,
    "n": "ESTRUTURA (CONCRETO, FORMAS, ARMAÇÃO)",
    "p": "6º/Plat",
    "i": "3.6.2",
    "d": "Concreto usinado fck 25 MPa estrutural, bombeado, slump 100±20",
    "q": 28.591,
    "c": 12957.67,
    "h": 34.3,
    "a": 12,
    "b": 13
  },
  {
    "g": 3,
    "n": "ESTRUTURA (CONCRETO, FORMAS, ARMAÇÃO)",
    "p": "6º/Plat",
    "i": "3.6.3",
    "d": "Lançamento, adensamento e acabamento de concreto estrutural",
    "q": 28.591,
    "c": 700.49,
    "h": 157.3,
    "a": 12,
    "b": 13
  },
  {
    "g": 3,
    "n": "ESTRUTURA (CONCRETO, FORMAS, ARMAÇÃO)",
    "p": "6º/Plat",
    "i": "3.6.4",
    "d": "Forma de chapa compensada plastificada 18 mm, 4 utilizações",
    "q": 328.178,
    "c": 21003.36,
    "h": 738.4,
    "a": 11,
    "b": 13
  },
  {
    "g": 3,
    "n": "ESTRUTURA (CONCRETO, FORMAS, ARMAÇÃO)",
    "p": "6º/Plat",
    "i": "3.6.5",
    "d": "Material Forma - (Apenas Material) - 3 Utililizações - Vigas-Pilares-Lajes 6ºPAV",
    "q": 328.178,
    "c": 6707.95,
    "h": 0,
    "a": 11,
    "b": 13
  },
  {
    "g": 3,
    "n": "ESTRUTURA (CONCRETO, FORMAS, ARMAÇÃO)",
    "p": "6º/Plat",
    "i": "3.6.6",
    "d": "Aço  - (Apenas Material) - Vigas-Pilares-Lajes 6ºPAV",
    "q": 2272.2,
    "c": 14769.3,
    "h": 0,
    "a": 11,
    "b": 13
  },
  {
    "g": 3,
    "n": "ESTRUTURA (CONCRETO, FORMAS, ARMAÇÃO)",
    "p": "6º/Plat",
    "i": "3.7.1",
    "d": "Armação aço CA-50 incl. corte, dobra, montagem e perdas",
    "q": 2015.37,
    "c": 10076.85,
    "h": 280.7,
    "a": 12,
    "b": 13
  },
  {
    "g": 3,
    "n": "ESTRUTURA (CONCRETO, FORMAS, ARMAÇÃO)",
    "p": "6º/Plat",
    "i": "3.7.2",
    "d": "Concreto usinado fck 25 MPa estrutural, bombeado, slump 100±20",
    "q": 25.274,
    "c": 11453.95,
    "h": 0.0,
    "a": 13,
    "b": 14
  },
  {
    "g": 3,
    "n": "ESTRUTURA (CONCRETO, FORMAS, ARMAÇÃO)",
    "p": "6º/Plat",
    "i": "3.7.3",
    "d": "Lançamento, adensamento e acabamento de concreto estrutural",
    "q": 25.274,
    "c": 619.2,
    "h": 17.3,
    "a": 13,
    "b": 14
  },
  {
    "g": 3,
    "n": "ESTRUTURA (CONCRETO, FORMAS, ARMAÇÃO)",
    "p": "6º/Plat",
    "i": "3.7.4",
    "d": "Forma de chapa compensada plastificada 18 mm, 4 utilizações",
    "q": 309.729,
    "c": 19822.66,
    "h": 552.2,
    "a": 13,
    "b": 14
  },
  {
    "g": 3,
    "n": "ESTRUTURA (CONCRETO, FORMAS, ARMAÇÃO)",
    "p": "6º/Plat",
    "i": "3.7.5",
    "d": "Material Forma - (Apenas Material) - 3 Utililizações - Vigas-Pilares- 7ºPAV",
    "q": 309.729,
    "c": 6330.86,
    "h": 0,
    "a": 13,
    "b": 14
  },
  {
    "g": 3,
    "n": "ESTRUTURA (CONCRETO, FORMAS, ARMAÇÃO)",
    "p": "6º/Plat",
    "i": "3.7.6",
    "d": "Aço  - (Apenas Material) - Vigas-Pilares 7ºPAV",
    "q": 2015.37,
    "c": 13099.91,
    "h": 0,
    "a": 13,
    "b": 14
  }
];

// remonta mantendo grupo 1 na frente, depois 2 e 3, depois o resto
const g1 = mantidos.filter(d => d.g === 1);
const resto = mantidos.filter(d => d.g !== 1);
const out = [...g1, ...novos, ...resto];

fs.writeFileSync(p, JSON.stringify(out));

const somaG = g => novos.filter(x=>x.g===g).reduce((s,x)=>s+x.c,0);
console.log('dados.json atualizado. Backup em dados.json.bak');
console.log('  Itens antigos removidos (G2+G3):', data.length - mantidos.length);
console.log('  Itens novos inseridos (G2+G3):', novos.length);
console.log('  Novo subtotal G2: R$', somaG(2).toFixed(2));
console.log('  Novo subtotal G3: R$', somaG(3).toFixed(2));
console.log('  Total de itens no arquivo:', out.length);
