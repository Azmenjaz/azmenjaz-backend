const axios = require('axios');

const TP_TOKEN = '1c5c3efe892baaf3cdbf1bb1681b01f7';
const TP_MARKER = '604468';
const BASE_V1 = 'https://api.travelpayouts.com/v1';
const BASE_V2 = 'https://api.travelpayouts.com/v2';

// SAR ≈ 0.042 RUB (approximate)
const rubToSar = (rub) => Math.round(rub * 0.042);

const AIRLINES = {
    'F3': 'فلاي أرابيا', 'XY': 'طيران ناس',
    'SV': 'الخطوط السعودية', 'F0': 'فلاي ديل',
    'FZ': 'فلاي دبي', 'EK': 'طيران الإمارات',
    'QR': 'القطرية', 'GF': 'الخليج',
    'WY': 'عُمان للطيران', 'KU': 'الكويتية',
    'MS': 'مصر للطيران', 'RJ': 'الملكية الأردنية',
    'TK': 'تركيش إيرلاينز', 'LH': 'لوفتهانزا',
    'EY': 'الاتحاد', 'J9': 'جزيرة',
};

const CITIES = {
    'RUH': 'الرياض', 'JED': 'جدة', 'DMM': 'الدمام',
    'AHB': 'أبها', 'MED': 'المدينة', 'TIF': 'الطائف',
    'DXB': 'دبي', 'AUH': 'أبوظبي', 'DOH': 'الدوحة',
    'CAI': 'القاهرة', 'IST': 'إسطنبول', 'BAH': 'البحرين',
    'KWI': 'الكويت', 'MCT': 'مسقط', 'BEY': 'بيروت',
    'AMM': 'عمّان', 'BKK': 'بانكوك', 'KUL': 'كوالالمبور',
    'SIN': 'سنغافورة', 'MLE': 'المالديف', 'LHR': 'لندن',
    'CDG': 'باريس', 'MAD': 'مدريد', 'FCO': 'روما',
    'FRA': 'فرانكفورت', 'DEL': 'نيودلهي', 'GIZ': 'جازان',
    'ELQ': 'القصيم', 'TUU': 'تبوك', 'AJF': 'الجوف',
    'YNB': 'ينبع', 'HOF': 'الأحساء', 'SSH': 'شرم الشيخ',
    'DPS': 'بالي', 'SHJ': 'الشارقة', 'EBL': 'أربيل',
    'BGW': 'بغداد', 'KRT': 'الخرطوم', 'TUN': 'تونس',
    'CMN': 'الدار البيضاء', 'RAK': 'مراكش', 'ALG': 'الجزائر',
    'ESB': 'أنقرة', 'AYT': 'أنطاليا', 'TZX': 'طرابزون',
    'ADB': 'إزمير', 'BJV': 'بودروم', 'SAW': 'إسطنبول صبيحة',
    'MXP': 'ميلان', 'AMS': 'أمستردام', 'VIE': 'فيينا',
    'GVA': 'جنيف', 'ATH': 'أثينا', 'SVO': 'موسكو',
    'NRT': 'طوكيو', 'ICN': 'سيول', 'HKG': 'هونغ كونغ',
    'BOM': 'مومباي', 'ISB': 'إسلام أباد', 'LHE': 'لاهور',
    'KHI': 'كراتشي', 'GYD': 'باكو', 'TBS': 'تبليسي',
    'ADD': 'أديس أبابا', 'NBO': 'نيروبي',
    'JFK': 'نيويورك', 'LAX': 'لوس أنجلوس',
    'YYZ': 'تورنتو', 'SYD': 'سيدني', 'MEL': 'ملبورن',
    'CGK': 'جاكرتا', 'CMB': 'كولومبو', 'MNL': 'مانيلا',
    'HBE': 'الإسكندرية', 'HRG': 'الغردقة',
    'LGW': 'لندن جاتويك', 'MAN': 'مانشستر',
    'BCN': 'برشلونة', 'MUC': 'ميونخ', 'BER': 'برلين',
    'PEK': 'بكين', 'ZRH': 'زيورخ',
    'HAS': 'حائل', 'EAM': 'نجران', 'BHH': 'بيشة', 'ABT': 'الباحة',
    'RAE': 'عرعر', 'URY': 'القريات',
};

const COUNTRIES = {
    'sa': 'السعودية', 'ae': 'الإمارات', 'qa': 'قطر',
    'bh': 'البحرين', 'kw': 'الكويت', 'om': 'عُمان',
    'eg': 'مصر', 'jo': 'الأردن', 'lb': 'لبنان',
    'iq': 'العراق', 'sd': 'السودان', 'tn': 'تونس',
    'ma': 'المغرب', 'dz': 'الجزائر', 'ly': 'ليبيا',
    'tr': 'تركيا', 'gb': 'المملكة المتحدة',
    'fr': 'فرنسا', 'es': 'إسبانيا', 'it': 'إيطاليا',
    'de': 'ألمانيا', 'nl': 'هولندا', 'at': 'النمسا',
    'ch': 'سويسرا', 'gr': 'اليونان', 'ru': 'روسيا',
    'pt': 'البرتغال', 'be': 'بلجيكا',
    'dk': 'الدنمارك', 'se': 'السويد', 'no': 'النرويج',
    'fi': 'فنلندا', 'ie': 'إيرلندا',
    'th': 'تايلاند', 'my': 'ماليزيا', 'sg': 'سنغافورة',
    'id': 'إندونيسيا', 'mv': 'المالديف', 'in': 'الهند',
    'lk': 'سريلانكا', 'ph': 'الفلبين', 'jp': 'اليابان',
    'kr': 'كوريا الجنوبية', 'cn': 'الصين', 'hk': 'هونغ كونغ',
    'pk': 'باكستان', 'az': 'أذربيجان', 'ge': 'جورجيا',
    'et': 'إثيوبيا', 'ke': 'كينيا',
    'us': 'الولايات المتحدة', 'ca': 'كندا',
    'au': 'أستراليا',
};

const COUNTRY_ISO = {
    'RUH': 'sa', 'JED': 'sa', 'DMM': 'sa', 'AHB': 'sa', 'TIF': 'sa', 'MED': 'sa',
    // ... add more if needed
};

class TravelpayoutsService {
    static async getPopularDeals(origin = 'RUH') {
        try {
            const url = `${BASE_V1}/prices/cheap?origin=${origin}&currency=rub&token=${TP_TOKEN}`;
            const response = await axios.get(url);
            const data = response.data;

            if (!data || !data.success) return { success: false, error: 'TP API error' };

            let deals = [];
            for (const [dest, stations] of Object.entries(data.data)) {
                const ticket = stations[0] || Object.values(stations)[0];
                if (!ticket) continue;

                const iso = COUNTRY_ISO[dest] || 'xx';
                deals.push({
                    origin,
                    destination: dest,
                    origin_ar: CITIES[origin] || origin,
                    dest_ar: CITIES[dest] || dest,
                    country: COUNTRIES[iso] || '',
                    country_iso: iso,
                    price_sar: rubToSar(ticket.price),
                    price_rub: ticket.price,
                    airline: AIRLINES[ticket.airline] || ticket.airline,
                    airline_code: ticket.airline,
                    departure: ticket.departure_at,
                    link: `https://www.aviasales.com/search/${origin}${ticket.departure_at.split('T')[0].replace(/-/g, '')}${dest}1?marker=${TP_MARKER}`
                });
            }

            deals.sort((a, b) => a.price_sar - b.price_sar);
            return { success: true, deals: deals.slice(0, 20), origin_ar: CITIES[origin] || origin };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async getMonthMatrix(origin, destination, month) {
        try {
            const url = `${BASE_V2}/prices/month-matrix?origin=${origin}&destination=${destination}&month=${month}&currency=rub&token=${TP_TOKEN}`;
            const response = await axios.get(url);
            if (!response.data || !response.data.success) return { success: false, error: 'TP API error' };

            const days = response.data.data.map(item => ({
                date: item.depart_date,
                price_sar: rubToSar(item.price),
                transfers: item.transfers
            })).sort((a, b) => a.date.localeCompare(b.date));

            return { success: true, days };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

module.exports = TravelpayoutsService;
