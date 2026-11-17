/**
 * Publicly identified wallets, shown with a name and badge everywhere the address appears.
 *
 * Every address here was checked to exist on Pi mainnet Horizon on 17 Nov 2026. The names
 * come from third parties (PiScan labels, exchange and news articles); none is an on-chain
 * proof of ownership, which is why each entry says where the name comes from.
 */
export type WalletCategory = "foundation" | "exchange" | "whale";
export type WalletLogo = "pi" | "okx" | "bitget" | "whale";

export interface KnownWallet {
  address: string;
  label: string;
  labelAr: string;
  category: WalletCategory;
  logo: WalletLogo;
  /** Where the name comes from. */
  source: string;
  sourceAr: string;
  note?: string;
  noteAr?: string;
}

export const knownWallets: KnownWallet[] = [
  {
    address: "GBQQRIQKS7XLMWTTRM2EPMTRLPUGQJDLEKCGNDIFGTBZG4GL5CHHJI25",
    label: "Pi Foundation 1 · Mining rewards",
    labelAr: "Pi Foundation 1 · مكافآت التعدين",
    category: "foundation",
    logo: "pi",
    source: "PiScan label; matches the 65% mining-rewards allocation in the Pi whitepaper",
    sourceAr: "اسم PiScan، ومطابق لتخصيص 65% لمكافآت التعدين في الوايت بيبر",
    note: "Sends 50M Pi batches to the migration wallet GABT… and 500M Pi batches to GC5R….",
    noteAr: "بتبعت دفعات 50 مليون Pi لمحفظة الهجرة GABT… و500 مليون Pi لمحفظة GC5R….",
  },
  {
    address: "GDPDSLFVGEPX6FJKGZXSTJCPTSKKAI4KBHBAQCCKQDXISW3S5SJ6MGMS",
    label: "Pi Foundation 14 · Foundation reserve",
    labelAr: "Pi Foundation 14 · احتياطي الفاونديشن",
    category: "foundation",
    logo: "pi",
    source: "PiScan label; matches the 10% foundation reserve in the Pi whitepaper",
    sourceAr: "اسم PiScan، ومطابق لتخصيص 10% لاحتياطي الفاونديشن في الوايت بيبر",
  },
  {
    address: "GALKEOXXIJKX76OMG5XNAIZA4F4Q5VRQBYW4LDU57SWORA7X47NSW4NM",
    label: "Pi Foundation 3",
    labelAr: "Pi Foundation 3",
    category: "foundation",
    logo: "pi",
    source: "PiScan label",
    sourceAr: "اسم PiScan",
    note: "Received 5.4B Pi from the mining-rewards wallet on 30 Dec 2024.",
    noteAr: "استقبلت 5.4 مليار Pi من محفظة مكافآت التعدين في 30 ديسمبر 2024.",
  },
  {
    address: "GABT7EMPGNCQSZM22DIYC4FNKHUVJTXITUF6Y5HNIWPU4GA7BHT4GC5G",
    label: "Pi Core Team · Migration / distribution",
    labelAr: "الكور تيم · محفظة الهجرة والتوزيع",
    category: "foundation",
    logo: "pi",
    source: "Bitget News (\"distribution wallet used for operational purposes\") and community reports",
    sourceAr: "Bitget News (\"محفظة توزيع للأغراض التشغيلية\") وتقارير الكوميونيتي",
    note: "The \"Balance Migrated\" transfers to Pioneers come from this wallet.",
    noteAr: "تحويلات \"Balance Migrated\" للرواد بتيجي من المحفظة دي.",
  },
  {
    address: "GASIC7B3HWF2GAI7HWUOZADMY6KW6NDIYI4WMB2XYXT3M4AU2J3WVDBN",
    label: "Pi Foundation 4",
    labelAr: "Pi Foundation 4",
    category: "foundation",
    logo: "pi",
    source: "PiScan label",
    sourceAr: "اسم PiScan",
    note: "Held 2M Pi; reported to have moved 1.4M Pi to Gate.io. Almost empty now.",
    noteAr: "كان فيها 2 مليون Pi، واتقال إنها حوّلت 1.4 مليون Pi لـ Gate.io. شبه فاضية دلوقتي.",
  },
  {
    address: "GC5RNDCRO6DDM7NZDEMW3RIN5K6AHN6GMWSZ5SAH2TRJLVGQMB2I3BNJ",
    label: "Pi Core Team · Distribution (unnamed)",
    labelAr: "الكور تيم · محفظة توزيع (بدون اسم منشور)",
    category: "foundation",
    logo: "pi",
    source: "On-chain: receives 500M Pi batches from the mining-rewards wallet; no published name",
    sourceAr: "من البلوكتشين: بتستقبل دفعات 500 مليون Pi من محفظة التعدين؛ مفيش اسم منشور",
  },
  {
    address: "GALYJFJ5SVD45FBWN2GT4IW67SEZ3IBOFSBSPUFCWV427NBNLG3PXEQU",
    label: "OKX · Hot wallet",
    labelAr: "OKX · المحفظة الرئيسية",
    category: "exchange",
    logo: "okx",
    source: "Community and exchange-research reports; deposit addresses are M… muxed addresses of this wallet",
    sourceAr: "تقارير الكوميونيتي وأبحاث المنصات؛ عناوين الإيداع M… مشتقة من المحفظة دي",
  },
  {
    address: "GDFNWH6ZFJVHJDLBMNOUT35X4EEKQVJAO3ZDL4NL7VQJLC4PJOQFWJ75",
    label: "Bitget · Hot wallet",
    labelAr: "Bitget · المحفظة الرئيسية",
    category: "exchange",
    logo: "bitget",
    source: "Community and exchange-research reports; deposit addresses are M… muxed addresses of this wallet",
    sourceAr: "تقارير الكوميونيتي وأبحاث المنصات؛ عناوين الإيداع M… مشتقة من المحفظة دي",
  },
  {
    address: "GASWBDATCXXIUGHR7DWSFAAONZB2L5NFMBTDCYQQ2TQLRQNCTKJ2AODM",
    label: "Whale GAS…ODM · owner unknown",
    labelAr: "الحوت GAS…ODM · صاحبه غير معروف",
    category: "whale",
    logo: "whale",
    source: "Largest non-foundation holder; mostly funded by OKX withdrawals (on-chain). Owner not confirmed.",
    sourceAr: "أكبر حامل خارج الفاونديشن؛ تمويله أغلبه من سحوبات OKX (من البلوكتشين). صاحبه غير مؤكد.",
  },
];

const byAddress = new Map(knownWallets.map((w) => [w.address, w]));

export function knownWallet(address: string | undefined | null) {
  return address ? byAddress.get(address) : undefined;
}
