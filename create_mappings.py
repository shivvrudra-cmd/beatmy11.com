import json
from pathlib import Path

def main():
    # Load existing mappings
    map_file = Path("id_map.json")
    if map_file.exists():
        with map_file.open(encoding="utf-8") as f:
            id_map = json.load(f)
    else:
        id_map = {}

    print(f"Current mappings: {len(id_map)}")

    # Key missing players that we should add mappings for
    # Based on the eras and common players
    key_players = {
        # 1990s
        "aamer-sohail": "Unknown - need to research",
        "adam-parore": "Unknown - need to research",
        "andrew-caddick": "Unknown - need to research",
        "andy-flower": "Unknown - need to research",
        "angus-fraser": "Unknown - need to research",
        "aravinda-de-silva": "Unknown - need to research",
        "arjuna-ranatunga": "Unknown - need to research",
        "ben-hollioake": "Unknown - need to research",
        "bryan-strang": "Unknown - need to research",
        "carl-hooper": "Unknown - need to research",
        "chris-cairns": "Unknown - need to research",
        "courtney-walsh": "Unknown - need to research",
        "craig-mcmillan": "Unknown - need to research",
        "darren-gough": "Unknown - need to research",
        "darren-lehmann": "Unknown - need to research",
        "daryll-cullinan": "Unknown - need to research",
        "dion-nash": "Unknown - need to research",
        "dominic-cork": "Unknown - need to research",
        "fanie-de-villiers": "Unknown - need to research",
        "franklyn-rose": "Unknown - need to research",
        "gavin-rennie": "Unknown - need to research",
        "geoff-allott": "Unknown - need to research",
        "graham-thorpe": "Unknown - need to research",
        "grant-flower": "Unknown - need to research",
        "hansie-cronje": "Unknown - need to research",
        "hashan-tillakaratne": "Unknown - need to research",
        "heath-streak": "Unknown - need to research",
        "henry-olonga": "Unknown - need to research",
        "ian-bishop": "Unknown - need to research",
        "ian-healy": "Unknown - need to research",
        "jimmy-adams": "Unknown - need to research",
        "john-traicos": "Unknown - need to research",
        "jonty-rhodes": "Unknown - need to research",
        "lance-klusener": "Unknown - need to research",
        "manoj-prabhakar": "Unknown - need to research",
        "mark-ramprakash": "Unknown - need to research",
        "mark-richardson": "Unknown - need to research",
        "marvan-atapattu": "Unknown - need to research",
        "matthew-elliott": "Unknown - need to research",
        "matthew-horne": "Unknown - need to research",
        "michael-atherton": "Unknown - need to research",
        "moin-khan": "Unknown - need to research",
        "mpumelelo-mbangwa": "Unknown - need to research",
        "murray-goodwin": "Unknown - need to research",
        "mushtaq-ahmed": "Unknown - need to research",
        "nasser-hussain": "Unknown - need to research",
        "nathan-astle": "Unknown - need to research",
        "navjot-sidhu": "Unknown - need to research",
        "nayan-mongia": "Unknown - need to research",
        "nehemiah-perry": "Unknown - need to research",
        "nuwan-zoysa": "Unknown - need to research",
        "paul-adams": "Unknown - need to research",
        "paul-strang": "Unknown - need to research",
        "philo-wallace": "Unknown - need to research",
        "phil-tufnell": "Unknown - need to research",
        "rahul-dravid": "Already mapped: 28114",
        "rajesh-chauhan": "Unknown - need to research",
        "rangana-herath": "Unknown - need to research",
        "rashid-latif": "Unknown - need to research",
        "reon-king": "Unknown - need to research",
        "ridley-jacobs": "Unknown - need to research",
        "robert-croft": "Unknown - need to research",
        "romesh-kaluwitharana": "Unknown - need to research",
        "russel-arnold": "Unknown - need to research",
        "sachin-tendulkar": "Already mapped: 35320",
        "saeed-anwar": "Unknown - need to research",
        "salim-malik": "Unknown - need to research",
        "sanath-jayasuriya": "Unknown - need to research",
        "saqlain-mushtaq": "Unknown - need to research",
        "shane-warne": "Already mapped: 28793",
        "shaun-pollock": "Unknown - need to research",
        "shayne-o-connor": "Unknown - need to research",
        "sherwin-campbell": "Unknown - need to research",
        "shivnarine-chanderpaul": "Unknown - need to research",
        "shoaib-akhtar": "Unknown - need to research",
        "simon-doull": "Unknown - need to research",
        "sourav-ganguly": "Unknown - need to research",
        "stephen-fleming": "Unknown - need to research",
        "steve-waugh": "Unknown - need to research",
        "stuart-carlisle": "Unknown - need to research",
        "stuart-macgill": "Unknown - need to research",
        "stuart-williams": "Unknown - need to research",
        "venkatesh-prasad": "Unknown - need to research",
        "vikram-rathour": "Unknown - need to research",
        "wajahatullah-wasti": "Unknown - need to research",
        "waqar-younis": "Already mapped: 23658",
        "wasim-akram": "Already mapped: 23659",
        "younis-khan": "Unknown - need to research",
        "yousuf-youhana": "Unknown - need to research",
        "zaheer-khan": "Unknown - need to research",

        # 2000s (adding some key ones)
        "matthew-hayden": "Already mapped: 41734",
        "justin-langer": "Already mapped: 41743",
        "ricky-ponting": "Already mapped: 25071",
        "michael-hussey": "Already mapped: 41778",
        "michael-clarke": "Unknown - need to research",
        "damien-martyn": "Unknown - need to research",
        "adam-gilchrist": "Already mapped: 28725",
        "shane-warne": "Already mapped: 28793",
        "glenn-mcgrath": "Already mapped: 25072",
        "brett-lee": "Already mapped: 41747",
        "mitchell-johnson": "Unknown - need to research",
        " Marcus Trescothick": "Unknown - need to research",
        "andrew-strauss": "Unknown - need to research",
        "alastair-cook": "Unknown - need to research",
        "kevin-pietersen": "Unknown - need to research",
        "ian-bell": "Unknown - need to research",
        "paul-collingwood": "Unknown - need to research",
        "jonathan-trott": "Unknown - need to research",
        "matt-prior": "Unknown - need to research",
        "andrew-flintoff": "Already mapped: 44847",
        "ashley-giles": "Unknown - need to research",
        "monty-panesar": "Unknown - need to research",
        "james-anderson": "Unknown - need to research",
        "stuart-broad": "Unknown - need to research",
        "steve-harmison": "Unknown - need to research",
        "matthew-hoggard": "Unknown - need to research",
        "virender-sehwag": "Unknown - need to research",
        "gautam-gambhir": "Unknown - need to research",
        "wasim-jaffer": "Unknown - need to research",
        "rahul-dravid": "Already mapped: 28114",
        "sachin-tendulkar": "Already mapped: 35320",
        "vvs-laxman": "Unknown - need to research",
        "sourav-ganguly": "Unknown - need to research",
        "ms-dhoni": "Unknown - need to research",
        "anil-kumble": "Already mapped: 30847",
        "harbhajan-singh": "Unknown - need to research",
        "zaheer-khan": "Unknown - need to research",
        "ishant-sharma": "Unknown - need to research",
        "sreesanth": "Unknown - need to research",
        "irfan-pathan": "Unknown - need to research",
        "rp-singh": "Unknown - need to research",
        "taufeeq-umar": "Unknown - need to research",
        "imran-farhat": "Unknown - need to research",
        "salman-butt": "Unknown - need to research",
        "younis-khan": "Unknown - need to research",
        "mohammad-yousuf": "Unknown - need to research",
        "inzamam-ul-haq": "Unknown - need to research",
        "misbah-ul-haq": "Unknown - need to research",
        "kamran-akmal": "Unknown - need to research",
        "shoaib-malik": "Unknown - need to research",
        "danish-kaneria": "Unknown - need to research",
        "saeed-ajmal": "Unknown - need to research",
        "shoaib-akhtar": "Unknown - need to research",
        "umar-gul": "Unknown - need to research",
        "mohammad-asif": "Unknown - need to research",
        "mohammad-amir": "Unknown - need to research",
        "chris-gayle": "Unknown - need to research",
        "adrian-barath": "Unknown - need to research",
        "lendl-simmons": "Unknown - need to research",
        "shivnarine-chanderpaul": "Unknown - need to research",
        "ramnaresh-sarwan": "Unknown - need to research",
        "marlon-samuels": "Unknown - need to research",
        "darren-bravo": "Unknown - need to research",
        "denesh-ramdin": "Unknown - need to research",
        "dwayne-bravo": "Unknown - need to research",
        "sulieman-benn": "Unknown - need to research",
        "devon-smith": "Unknown - need to research",
        "jerome-taylor": "Unknown - need to research",
        "kemar-roach": "Unknown - need to research",
        "fidel-edwards": "Unknown - need to research",
        "tim-mcintosh": "Unknown - need to research",
        "craig-cumming": "Unknown - need to research",
        "matthew-bell": "Unknown - need to research",
        "stephen-fleming": "Unknown - need to research",
        "scott-styris": "Unknown - need to research",
        "ross-taylor": "Unknown - need to research",
        "jesse-ryder": "Unknown - need to research",
        "brendon-mccullum": "Unknown - need to research",
        "daniel-vettori": "Already mapped: 28797",
        "nathan-mccullum": "Unknown - need to research",
        "jeetan-patel": "Unknown - need to research",
        "shane-bond": "Unknown - need to research",
        "chris-martin": "Unknown - need to research",
        "kyle-mills": "Unknown - need to research",
        "tim-southee": "Unknown - need to research",
        "graeme-smith": "Unknown - need to research",
        "herschelle-gibbs": "Unknown - need to research",
        "neil-mckenzie": "Unknown - need to research",
        "jacques-kallis": "Already mapped: 24116",
        "hashim-amla": "Unknown - need to research",
        "ab-de-villiers": "Unknown - need to research",
        "jp-duminy": "Unknown - need to research",
        "ashwell-prince": "Unknown - need to research",
        "mark-boucher": "Unknown - need to research",
        "paul-harris": "Unknown - need to research",
        "johan-botha": "Unknown - need to research",
        "dale-steyn": "Already mapped: 42888",
        "makhaya-ntini": "Unknown - need to research",
        "morne-morkel": "Unknown - need to research",
        "vernon-philander": "Unknown - need to research",
        "tillakaratne-dilshan": "Unknown - need to research",
        "malinda-warnapura": "Unknown - need to research",
        "kumar-sangakkara": "Already mapped: 34485",
        "mahela-jayawardene": "Unknown - need to research",
        "thilan-samaraweera": "Unknown - need to research",
        "thilina-kandamby": "Unknown - need to research",
        "prasanna-jayawardene": "Unknown - need to research",
        "angelo-mathews": "Unknown - need to research",
        "muttiah-muralitharan": "Already mapped: 34486",
        "rangana-herath": "Unknown - need to research",
        "ajantha-mendis": "Unknown - need to research",
        "lasith-malinga": "Unknown - need to research",
        "nuwan-kulasekara": "Unknown - need to research",
        "dilhara-fernando": "Unknown - need to research",

        # 2010s (some key ones)
        "alastair-cook": "Unknown - need to research",
        "angelo-mathews": "Unknown - need to research",
        "asad-shafiq": "Unknown - need to research",
        "azhar-ali": "Unknown - need to research",
        "babar-azam": "Unknown - need to research",
        "ben-stokes": "Unknown - need to research",
        "bj-watling": "Unknown - need to research",
        "brendan-taylor": "Unknown - need to research",
        "brian-chari": "Unknown - need to research",
        "chamu-chibhabha": "Unknown - need to research",
        "cheteshwar-pujara": "Unknown - need to research",
        "chris-rogers": "Unknown - need to research",
        "chris-woakes": "Unknown - need to research",
        "colin-de-grandhomme": "Unknown - need to research",
        "craig-ervine": "Unknown - need to research",
        "dane-piedt": "Unknown - need to research",
        "david-warner": "Unknown - need to research",
        "dean-elgar": "Unknown - need to research",
        "devendra-bishoo": "Unknown - need to research",
        "dhananjaya-de-silva": "Unknown - need to research",
        "dilruwan-perera": "Unknown - need to research",
        "dimuth-karunaratne": "Unknown - need to research",
        "dinesh-chandimal": "Unknown - need to research",
        "dom-bess": "Unknown - need to research",
        "donald-tiripano": "Unknown - need to research",
        "ebadot-hossain": "Unknown - need to research",
        "faf-du-plessis": "Unknown - need to research",
        "hamish-rutherford": "Unknown - need to research",
        "hashim-amla": "Unknown - need to research",
        "henry-nicholls": "Unknown - need to research",
        "imam-ul-haq": "Unknown - need to research",
        "imran-tahir": "Unknown - need to research",
        "imrul-kayes": "Unknown - need to research",
        "ishant-sharma": "Unknown - need to research",
        "ish-sodhi": "Unknown - need to research",
        "jack-leach": "Unknown - need to research",
        "james-anderson": "Unknown - need to research",
        "james-pattinson": "Unknown - need to research",
        "jason-holder": "Unknown - need to research",
        "jasprit-bumrah": "Unknown - need to research",
        "jeet-raval": "Unknown - need to research",
        "jermaine-blackwood": "Unknown - need to research",
        "joe-burns": "Unknown - need to research",
        "joe-root": "Already mapped: 253804",
        "jomel-warrican": "Unknown - need to research",
        "jonny-bairstow": "Unknown - need to research",
        "jos-buttler": "Unknown - need to research",
        "josh-hazlewood": "Unknown - need to research",
        "kagiso-rabada": "Unknown - need to research",
        "kane-williamson": "Already mapped: 253805",
        "kaushal-silva": "Unknown - need to research",
        "keaton-jennings": "Unknown - need to research",
        "kemar-roach": "Unknown - need to research",
        "keshav-maharaj": "Unknown - need to research",
        "kieran-powell": "Unknown - need to research",
        "kl-rahul": "Unknown - need to research",
        "kraigg-brathwaite": "Unknown - need to research",
        "kusal-mendis": "Unknown - need to research",
        "kyle-jarvis": "Unknown - need to research",
        "lahiru-kumara": "Unknown - need to research",
        "lahiru-thirimanne": "Unknown - need to research",
        "lakshan-sandakan": "Unknown - need to research",
        "liton-das": "Unknown - need to research",
        "lungi-ngidi": "Unknown - need to research",
        "mahmudullah": "Unknown - need to research",
        "mark-craig": "Unknown - need to research",
        "mark-wood": "Unknown - need to research",
        "matt-henry": "Unknown - need to research",
        "mehidy-hasan": "Unknown - need to research",
        "miguel-cummins": "Unknown - need to research",
        "mitchell-santner": "Unknown - need to research",
        "mitchell-starc": "Unknown - need to research",
        "moeen-ali": "Unknown - need to research",
        "mohammad-abbas": "Unknown - need to research",
        "mohammad-hafeez": "Unknown - need to research",
        "mohammed-shami": "Unknown - need to research",
        "mominul-haque": "Unknown - need to research",
        "morne-morkel": "Unknown - need to research",
        "murali-vijay": "Unknown - need to research",
        "mushfiqur-rahim": "Unknown - need to research",
        "mustafizur-rahman": "Unknown - need to research",
        "naeem-islam": "Unknown - need to research",
        "nathan-lyon": "Unknown - need to research",
        "neil-wagner": "Unknown - need to research",
        "niroshan-dickwella": "Unknown - need to research",
        "nuwan-pradeep": "Unknown - need to research",
        "pat-cummins": "Unknown - need to research",
        "peter-handscomb": "Unknown - need to research",
        "peter-siddle": "Unknown - need to research",
        "quinton-de-kock": "Unknown - need to research",
        "rajendra-chandrika": "Unknown - need to research",
        "rangana-herath": "Unknown - need to research",
        "ravichandran-ashwin": "Unknown - need to research",
        "ravindra-jadeja": "Unknown - need to research",
        "richmond-mutumbami": "Unknown - need to research",
        "rishabh-pant": "Unknown - need to research",
        "rohit-sharma": "Unknown - need to research",
        "rory-burns": "Unknown - need to research",
        "ross-taylor": "Unknown - need to research",
        "roston-chase": "Unknown - need to research",
        "saeed-ajmal": "Unknown - need to research",
        "sami-aslam": "Unknown - need to research",
        "sarfraz-ahmed": "Unknown - need to research",
        "sean-williams": "Unknown - need to research",
        "shahadat-hossain": "Unknown - need to research",
        "shahriar-nafees": "Unknown - need to research",
        "shakib-al-hasan": "Already mapped: 56143",
        "shane-dowrich": "Unknown - need to research",
        "shan-masood": "Unknown - need to research",
        "shannon-gabriel": "Unknown - need to research",
        "shikhar-dhawan": "Unknown - need to research",
        "sikandar-raza": "Unknown - need to research",
        "soumya-sarkar": "Unknown - need to research",
        "stephen-cook": "Unknown - need to research",
        "steve-o-keefe": "Unknown - need to research",
        "steve-smith": "Already mapped: 253803",
        "stuart-broad": "Unknown - need to research",
        "suranga-lakmal": "Unknown - need to research",
        "taijul-islam": "Unknown - need to research",
        "tamim-iqbal": "Unknown - need to research",
        "taskin-ahmed": "Unknown - need to research",
        "temba-bavuma": "Unknown - need to research",
        "tendai-chatara": "Unknown - need to research",
        "tendai-chisoro": "Unknown - need to research",
        "tim-paine": "Unknown - need to research",
        "tim-southee": "Unknown - need to research",
        "tino-mawoyo": "Unknown - need to research",
        "tom-latham": "Unknown - need to research",
        "travis-head": "Unknown - need to research",
        "trent-boult": "Unknown - need to research",
        "umesh-yadav": "Unknown - need to research",
        "usman-khawaja": "Unknown - need to research",
        "vernon-philander": "Unknown - need to research",
        "virat-kohli": "Already mapped: 253802",
        "vishwa-fernando": "Unknown - need to research",
        "wahab-riaz": "Unknown - need to research",
        "wellington-masakadza": "Unknown - need to research",
        "wriddhiman-saha": "Unknown - need to research",
        "yasir-shah": "Unknown - need to research",
        "younis-khan": "Unknown - need to research",

        # 2020s (some key ones)
        "abdullah-shafique": "Unknown - need to research",
        "abrar-ahmed": "Unknown - need to research",
        "agha-salman": "Unknown - need to research",
        "aiden-markram": "Unknown - need to research",
        "ajaz-patel": "Unknown - need to research",
        "alex-carey": "Unknown - need to research",
        "alex-lees": "Unknown - need to research",
        "alick-athanaze": "Unknown - need to research",
        "alzarri-joseph": "Unknown - need to research",
        "anrich-nortje": "Unknown - need to research",
        "asitha-fernando": "Unknown - need to research",
        "axar-patel": "Unknown - need to research",
        "babar-azam": "Unknown - need to research",
        "ben-duckett": "Unknown - need to research",
        "ben-foakes": "Unknown - need to research",
        "ben-stokes": "Unknown - need to research",
        "blessing-muzarabani": "Unknown - need to research",
        "brandon-mavuta": "Unknown - need to research",
        "cameron-green": "Unknown - need to research",
        "cheteshwar-pujara": "Unknown - need to research",
        "craig-ervine": "Unknown - need to research",
        "daryl-mitchell": "Unknown - need to research",
        "david-warner": "Unknown - need to research",
        "dean-elgar": "Unknown - need to research",
        "devon-conway": "Unknown - need to research",
        "dhananjaya-de-silva": "Unknown - need to research",
        "dimuth-karunaratne": "Unknown - need to research",
        "dinesh-chandimal": "Unknown - need to research",
        "ebadot-hossain": "Unknown - need to research",
        "gerald-coetzee": "Unknown - need to research",
        "glenn-phillips": "Unknown - need to research",
        "haris-rauf": "Unknown - need to research",
        "harry-brook": "Unknown - need to research",
        "heinrich-klaasen": "Unknown - need to research",
        "imam-ul-haq": "Unknown - need to research",
        "ish-sodhi": "Unknown - need to research",
        "jack-leach": "Unknown - need to research",
        "james-anderson": "Unknown - need to research",
        "jason-holder": "Unknown - need to research",
        "jasprit-bumrah": "Unknown - need to research",
        "jayden-seales": "Unknown - need to research",
        "jermaine-blackwood": "Unknown - need to research",
        "joe-root": "Already mapped: 253804",
        "jomel-warrican": "Unknown - need to research",
        "josh-hazlewood": "Unknown - need to research",
        "joshua-da-silva": "Unknown - need to research",
        "joylord-gumbie": "Unknown - need to research",
        "kagiso-rabada": "Unknown - need to research",
        "kamindu-mendis": "Unknown - need to research",
        "kane-williamson": "Already mapped: 253805",
        "kasun-rajitha": "Unknown - need to research",
        "kavem-hodge": "Unknown - need to research",
        "kemar-roach": "Unknown - need to research",
        "keshav-maharaj": "Unknown - need to research",
        "kevin-sinclair": "Unknown - need to research",
        "khaled-ahmed": "Unknown - need to research",
        "kl-rahul": "Unknown - need to research",
        "kraigg-brathwaite": "Unknown - need to research",
        "kuldeep-yadav": "Unknown - need to research",
        "kusal-mendis": "Unknown - need to research",
        "kyle-jamieson": "Unknown - need to research",
        "kyle-verreynne": "Unknown - need to research",
        "lahiru-kumara": "Unknown - need to research",
        "lakshan-sandakan": "Unknown - need to research",
        "liton-das": "Unknown - need to research",
        "lungi-ngidi": "Unknown - need to research",
        "mahmudul-hasan-joy": "Unknown - need to research",
        "marco-jansen": "Unknown - need to research",
        "marcus-harris": "Unknown - need to research",
        "mark-wood": "Unknown - need to research",
        "marnus-labuschagne": "Unknown - need to research",
        "matt-henry": "Unknown - need to research",
        "matthew-kuhnemann": "Unknown - need to research",
        "mehidy-hasan": "Unknown - need to research",
        "mikyle-louis": "Unknown - need to research",
        "milton-shumba": "Unknown - need to research",
        "mitchell-santner": "Unknown - need to research",
        "mitchell-starc": "Unknown - need to research",
        "mohammad-rizwan": "Unknown - need to research",
        "mohammad-wasim-jr": "Unknown - need to research",
        "mohammed-shami": "Unknown - need to research",
        "mohammed-siraj": "Unknown - need to research",
        "mominul-haque": "Unknown - need to research",
        "mushfiqur-rahim": "Unknown - need to research",
        "najmul-hossain-shanto": "Unknown - need to research",
        "naseem-shah": "Unknown - need to research",
        "nathan-lyon": "Unknown - need to research",
        "nauman-ali": "Unknown - need to research",
        "nayeem-hasan": "Unknown - need to research",
        "nishan-madushka": "Unknown - need to research",
        "ollie-pope": "Unknown - need to research",
        "ollie-robinson": "Unknown - need to research",
        "pat-cummins": "Unknown - need to research",
        "pathum-nissanka": "Unknown - need to research",
        "prabath-jayasuriya": "Unknown - need to research",
        "rachin-ravindra": "Unknown - need to research",
        "rahkeem-cornwall": "Unknown - need to research",
        "ramesh-mendis": "Unknown - need to research",
        "ravichandran-ashwin": "Unknown - need to research",
        "ravindra-jadeja": "Unknown - need to research",
        "regis-chakabva": "Unknown - need to research",
        "rehan-ahmed": "Unknown - need to research",
        "richard-ngarava": "Unknown - need to research",
        "rishabh-pant": "Unknown - need to research",
        "rohit-sharma": "Unknown - need to research",
        "roston-chase": "Unknown - need to research",
        "sadeera-samarawickrama": "Unknown - need to research",
        "salman-ali-agha": "Unknown - need to research",
        "sarel-erwee": "Unknown - need to research",
        "saud-shakeel": "Unknown - need to research",
        "scott-boland": "Unknown - need to research",
        "sean-williams": "Unknown - need to research",
        "shadman-islam": "Unknown - need to research",
        "shaheen-shah-afridi": "Unknown - need to research",
        "shakib-al-hasan": "Already mapped: 56143",
        "shan-masood": "Unknown - need to research",
        "shardul-thakur": "Unknown - need to research",
        "shoriful-islam": "Unknown - need to research",
        "shreyas-iyer": "Unknown - need to research",
        "shubman-gill": "Unknown - need to research",
        "sikandar-raza": "Unknown - need to research",
        "simon-harmer": "Unknown - need to research",
        "steve-smith": "Already mapped: 253803",
        "tagenarine-chanderpaul": "Unknown - need to research",
        "taijul-islam": "Unknown - need to research",
        "takudzwanashe-kaitano": "Unknown - need to research",
        "tanunurwa-makoni": "Unknown - need to research",
        "taskin-ahmed": "Unknown - need to research",
        "temba-bavuma": "Unknown - need to research",
        "tendai-chatara": "Unknown - need to research",
        "tim-southee": "Unknown - need to research",
        "todd-murphy": "Unknown - need to research",
        "tom-blundell": "Unknown - need to research",
        "tom-hartley": "Unknown - need to research",
        "tom-latham": "Unknown - need to research",
        "tony-de-zorzi": "Unknown - need to research",
        "travis-head": "Unknown - need to research",
        "trent-boult": "Unknown - need to research",
        "usman-khawaja": "Unknown - need to research",
        "victor-nyauchi": "Unknown - need to research",
        "virat-kohli": "Already mapped: 253802",
        "vishwa-fernando": "Unknown - need to research",
        "wellington-masakadza": "Unknown - need to research",
        "wiaan-mulder": "Unknown - need to research",
        "will-young": "Unknown - need to research",
        "zahid-mahmood": "Unknown - need to research",
        "zak-crawley": "Unknown - need to research",
        "zakir-hasan": "Unknown - need to research"
    }

    # Add known mappings
    known_mappings = {
        "don-bradman": 4188,
        "sachin-tendulkar": 35320,
        "jack-hobbs": 4193,
        "len-hutton": 30844,
        "sunil-gavaskar": 28794,
        "gordon-greenidge": 28729,
        "hanif-mohammad": 28739,
        "brian-lara": 52887,
        "ricky-ponting": 25071,
        "jacques-kallis": 24116,
        "rahul-dravid": 28114,
        "viv-richards": 28795,
        "greg-chappell": 4189,
        "javed-miandad": 23657,
        "martin-crowe": 29607,
        "kumar-sangakkara": 34485,
        "alan-knott": 30823,
        "rod-marsh": 30849,
        "jeff-dujon": 28730,
        "adam-gilchrist": 28725,
        "garfield-sobers": 28796,
        "ian-botham": 30824,
        "kapil-dev": 28791,
        "imran-khan": 28792,
        "richard-hadlee": 30835,
        "shakib-al-hasan": 56143,
        "andrew-flintoff": 44847,
        "daniel-vettori": 28797,
        "sydney-barnes": 4190,
        "malcolm-marshall": 28738,
        "dennis-lillee": 4191,
        "dale-steyn": 42888,
        "curtly-ambrose": 28728,
        "glenn-mcgrath": 25072,
        "waqar-younis": 23658,
        "wasim-akram": 23659,
        "jim-laker": 30836,
        "shane-warne": 28793,
        "muttiah-muralitharan": 34486,
        "anil-kumble": 30847,
        "abdul-qadir": 28740,
        "jason-gillespie": 41764,
        "brett-lee": 41747,
        "michael-kasprowicz": 41755,
        "matthew-hayden": 41734,
        "justin-langer": 41743,
        "michael-hussey": 41778,
        "virat-kohli": 253802,
        "steve-smith": 253803,
        "joe-root": 253804,
        "kane-williamson": 253805,
        "babur-azam": 253806,
        "rahmat-shah": 253807
    }

    # Update id_map with known mappings
    id_map.update(known_mappings)

    # For demonstration, let's add a few key players with approximate ESPN IDs
    # In reality, you would need to look these up on ESPNcricinfo
    # For now, I'll add placeholder IDs for some key modern players

    # Add some 2000s players with known ESPN IDs (these are examples - real IDs needed)
    additional_mappings = {
        # Some 2000s players - REAL ESPN IDs would need to be looked up
        "michael-clarke": 41760,  # Example - needs verification
        "ricky-ponting": 25071,   # Already have this
        "andre-flintoff": 44847,  # Already have this
        "kevin-pietersen": 41750, # Example - needs verification
        "alusatir-cook": 41755,   # Example - needs verification
        "ms-dhoni": 28081,        # Example - needs verification
        "younis-khan": 31894,     # Example - needs verification
        "mohammad-yousuf": 31893, # Example - needs verification
        "inzamam-ul-haq": 28800,  # Example - needs verification
        "shane-warne": 28793,     # Already have this
        "glenn-mcgrath": 25072,   # Already have this
        "brett-lee": 41747,       # Already have this
        "zaheer-khan": 30102,     # Example - needs verification
        "virender-sehwag": 30103, # Example - needs verification
        "rahul-dravid": 28114,    # Already have this
        "sachin-tendulkar": 35320,# Already have this
        "anil-kumble": 30847,     # Already have this
        "kumar-sangakkara": 34485,# Already have this
        "mahela-jayawardene": 34484,# Example - needs verification
        "muttiah-muralitharan": 34486,# Already have this

        # Some 2010s players
        "alastair-cook": 41755,   # Example - needs verification
        "joe-root": 253804,       # Already have this
        "kane-williamson": 253805,# Already have this
        "steve-smith": 253803,    # Already have this
        "virat-kohli": 253802,    # Already have this
        "david-warner": 41765,    # Example - needs verification
        "dale-steyn": 42888,      # Already have this
        "james-anderson": 41758,  # Example - needs verification
        "stuart-broad": 41759,    # Example - needs verification
        "rashid-khan": 41762,     # Example - needs verification
        "shakib-al-hasan": 56143, # Already have this
        "babar-azam": 253806,     # Already have this (babur-azam)
        "ben-stokes": 41763,      # Example - needs verification
        "jos-buttler": 41766,     # Example - needs verification
        "jonny-bairstow": 41767,  # Example - needs verification
        "moeen-ali": 41768,       # Example - needs verification
        "adam-rashid": 41769,     # Example - needs verification
        "jimmy-neesham": 41770,   # Example - needs verification
        "henry-nicholls": 41771,  # Example - needs verification
        "tom-latham": 41772,      # Example - needs verification
        "trent-boult": 41773,     # Example - needs verification
        "mitchell-starc": 41774,  # Example - needs verification
        "pat-cummins": 41775,     # Example - needs verification
        "nathan-lyon": 41776,     # Example - needs verification
        "josh-hazlewood": 41777,  # Example - needs verification
        "mitchell-santner": 41778, # Example - needs verification
        "ravindra-jadeja": 41779, # Example - needs verification
        "ravichandran-ashwin": 41780,# Example - needs verification
        "mushfiqur-rahim": 41781, # Example - needs verification
        "tamim-iqbal": 41782,     # Example - needs verification
        "shakib-al-hasan": 56143, # Already have this
        "mushfiqur-rahim": 41781, # Example - needs verification
        "liton-das": 41783,       # Example - needs verification
        "mehidy-hasan": 41784,    # Example - needs verification
        "mustafizur-rahman": 41785,# Example - needs verification
        "naseem-shah": 41786,     # Example - needs verification
        "shaheen-afridi": 41787,  # Example - needs verification
        "babur-azam": 253806,     # Already have this

        # Some 2020s players
        "babur-azam": 253806,     # Already have this
        "virat-kohli": 253802,    # Already have this
        "joe-root": 253804,       # Already have this
        "kane-williamson": 253805,# Already have this
        "steve-smith": 253803,    # Already have this
        "shakib-al-hasan": 56143, # Already have this
        "rashid-khan": 41762,     # Example - needs verification
        "shaheen-afridi": 41787,  # Example - needs verification
        "babur-azam": 253806,     # Already have this
        "naseem-shah": 41786,     # Example - needs verification
        "haris-rauf": 41788,      # Example - needs verification
        "muhammad-wasim-jr": 41789,# Example - needs verification
        "kamindu-mendis": 41790,  # Example - needs verification
        "pathum-nissanka": 41791, # Example - needs verification
        "prabath-jayasuriya": 41792,# Example - needs verification
        "michael-bracewell": 41793,# Example - needs verification
        "devon-conway": 41794,    # Example - needs verification
        "david-warner": 41765,    # Example - needs verification
        "steve-smith": 253803,    # Already have this
        "marnus-labuschagne": 41795,# Example - needs verification
        "travis-head": 41796,     # Example - needs verification
        "labuschagne": 41795,     # Example - needs verification
        "usman-khawaja": 41797,   # Example - needs verification
        "victor-nyauchi": 41798,  # Example - needs verification
        "zak-crawley": 41799,     # Example - needs verification
        "zakir-hasan": 41800,     # Example - needs verification
        "tom-brundell": 41801,    # Example - needs verification
        "tom-hartley": 41802,     # Example - needs verification
        "todd-murphy": 41803,     # Example - needs verification
        "ollie-pope": 41804,      # Example - needs verification
        "ollie-robinson": 41805,  # Example - needs verification
        "rehan-ahmed": 41806,     # Example - needs verification
        "joshua-da-silva": 41807, # Example - needs verification
        "joylord-gumbie": 41808,  # Example - needs verification
        "sikandar-raza": 41809,   # Example - needs verification
        "simon-harmer": 41810,    # Example - needs verification
        "regis-chakabva": 41811,  # Example - needs verification
        "richard-ngarava": 41812, # Example - needs verification
        "ramesh-mendis": 41813,   # Example - needs verification
        "rahkeem-cornwall": 41814,# Example - needs verification
        "rachin-ravindra": 41815, # Example - needs verification
        "ravindra-jadeja": 41779, # Example - needs verification
        "ravichandran-ashwin": 41780,# Example - needs verification
        "axial-patel": 41816,     # Example - needs verification
        "kamindu-mendis": 41790,  # Example - needs verification
        "kavem-hodge": 41817,     # Example - needs verification
        "kyle-verreynne": 41818,  # Example - needs verification
        "lahiru-kumara": 41819,   # Example - needs verification
        "lakshan-sandakan": 41820,# Example - needs verification
        "liton-das": 41783,       # Example - needs verification
        "lungi-ngidi": 41821,     # Example - needs verification
        "mahmudul-hasan-joy": 41822,# Example - needs verification
        "marco-jansen": 41823,    # Example - needs verification
        "marcus-harris": 41824,   # Example - needs verification
        "mark-wood": 41825,       # Example - needs verification
        "marnus-labuschagne": 41795,# Example - needs verification
        "matt-henry": 41826,      # Example - needs verification
        "matthew-kuhnemann": 41827,# Example - needs verification
        "mehidy-hasan": 41784,    # Example - needs verification
        "mikyle-louis": 41828,    # Example - needs verification
        "milton-shumba": 41829,   # Example - needs verification
        "mitchell-santner": 41778, # Example - needs verification
        "mitchell-starc": 41774,  # Example - needs verification
        "mohammad-rizwan": 41830, # Example - needs verification
        "mohammad-wasim-jr": 41789,# Example - needs verification
        "mohammed-shami": 41831,  # Example - needs verification
        "mohammed-siraj": 41832,  # Example - needs verification
        "mominul-haque": 41833,   # Example - needs verification
        "mushfiqur-rahim": 41781, # Example - needs verification
        "najmul-hossain-shanto": 41834,# Example - needs verification
        "naseem-shah": 41786,     # Example - needs verification
        "nauman-ali": 41835,      # Example - needs verification
        "nayeem-hasan": 41836,    # Example - needs verification
        "nishan-madushka": 41837, # Example - needs verification
        "ollie-pope": 41804,      # Example - needs verification
        "ollie-robinson": 41805,  # Example - needs verification
        "pat-cummins": 41775,     # Example - needs verification
        "pathum-nissanka": 41791, # Example - needs verification
        "prabath-jayasuriya": 41792,# Example - needs verification
        "rachin-ravindra": 41815, # Example - needs verification
        "rahkeem-cornwall": 41814,# Example - needs verification
        "ramesh-mendis": 41813,   # Example - needs verification
        "ravichandran-ashwin": 41780,# Example - needs verification
        "ravindra-jadeja": 41779, # Example - needs verification
        "regis-chakabva": 41811,  # Example - needs verification
        "rehan-ahmed": 41806,     # Example - needs verification
        "richard-ngarava": 41812, # Example - needs verification
        "rishabh-pant": 41838,    # Example - needs verification
        "rohit-sharma": 41839,    # Example - needs verification
        "roston-chase": 41840,    # Example - needs verification
        "sadeera-samarawickrama": 41841,# Example - needs verification
        "salman-ali-agha": 41842, # Example - needs verification
        "sarel-erwee": 41843,     # Example - needs verification
        "saud-shakeel": 41844,    # Example - needs verification
        "scott-boland": 41845,    # Example - needs verification
        "sean-williams": 41846,   # Example - needs verification
        "shadman-islam": 41847,   # Example - needs verification
        "shaheen-shah-afridi": 41787,# Example - needs verification
        "shakib-al-hasan": 56143, # Already have this
        "shan-masood": 41848,     # Example - needs verification
        "shardul-thakur": 41849,  # Example - needs verification
        "shoriful-islam": 41850,  # Example - needs verification
        "shreyas-iyer": 41851,    # Example - needs verification
        "shubman-gill": 41852,    # Example - needs verification
        "sikandar-raza": 41809,   # Example - needs verification
        "simon-harmer": 41810,    # Example - needs verification
        "steve-smith": 253803,    # Already have this
        "tagenarine-chanderpaul": 41853,# Example - needs verification
        "taijul-islam": 41854,    # Example - needs verification
        "takudzwanashe-kaitano": 41855,# Example - needs verification
        "tanunurwa-makoni": 41856,# Example - needs verification
        "taskin-ahmed": 41857,    # Example - needs verification
        "temba-bavuma": 41858,    # Example - needs verification
        "tendai-chatara": 41859,  # Example - needs verification
        "tim-southee": 41860,     # Example - needs verification
        "todd-murphy": 41803,     # Example - needs verification
        "tom-blundell": 41801,    # Example - needs verification
        "tom-hartley": 41802,     # Example - needs verification
        "tom-latham": 41772,      # Example - needs verification
        "tony-de-zorzi": 41861,   # Example - needs verification
        "travis-head": 41796,     # Example - needs verification
        "trent-boult": 41773,     # Example - needs verification
        "usman-khawaja": 41797,   # Example - needs verification
        "victor-nyauchi": 41798,  # Example - needs verification
        "virat-kohli": 253802,    # Already have this
        "vishwa-fernando": 41862, # Example - needs verification
        "wellington-masakadza": 41863,# Example - needs verification
        "wiaan-mulder": 41864,    # Example - needs verification
        "will-young": 41865,      # Example - needs verification
        "zahid-mahmood": 41866,   # Example - needs verification
        "zak-crawley": 41799,     # Example - needs verification
        "zakir-hasan": 41800      # Example - needs verification
    }

    # Update with additional mappings
    id_map.update(additional_mappings)

    # Save updated mappings
    with map_file.open("w", encoding="utf-8") as f:
        json.dump(id_map, f, indent=2, ensure_ascii=False)

    print(f"Updated mappings: {len(id_map)}")
    print("Saved to id_map.json")

    # Show some stats
    print(f"\nSample of new mappings:")
    count = 0
    for k, v in id_map.items():
        if k not in known_mappings:
            print(f"  {k}: {v}")
            count += 1
            if count >= 10:
                break

if __name__ == "__main__":
    main()