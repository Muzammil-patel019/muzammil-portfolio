type Lesson = {
  slug: string;
  title: string;
  answer: string;
  explanation: string;
  takeaway: string;
  question: string;
  quizAnswer: string;
  followUp: { question: string; answer: string };
  reference: string;
  url: string;
};

type Topic = {
  id: string;
  heading: string;
  description: string;
  lessons: Lesson[];
};

const originalTopics: Topic[] = [
  {
    heading: "Vehicles",
    id: "vehicles",
    description: "Engines, gears, brakes and electric vehicles.",
    lessons: [
      {
        slug: "motorcycle",
        followUp: {
          question: "Why can a motorcycle stall when pulling away?",
          answer:
            "If the clutch grips faster than the engine can support the load, engine speed drops too low to keep it running.",
        },
        title: "How does a motorcycle move?",
        answer:
          "A petrol motorcycle turns energy from fuel into rotation at the rear wheel.",
        explanation:
          "A spark plug ignites compressed air and fuel. The expanding gases push a piston, which turns the crankshaft. The clutch and gearbox pass that rotation to a chain, belt, or shaft that drives the rear wheel. As the tyre pushes backward against the road, the road pushes the bike forward.",
        takeaway:
          "On a parked bike or in a photo, trace the path from the engine to the rear wheel. A chain is easy to spot beside the rear tyre.",
        question: "What does the piston turn?",
        quizAnswer: "The crankshaft.",
        reference: "U.S. Department of Energy on combustion engines",
        url: "https://www.energy.gov/cmei/vehicles/articles/internal-combustion-engine-basics",
      },
      {
        slug: "clutch-and-gears",
        followUp: {
          question:
            "Why does the engine sound faster in a lower gear at the same road speed?",
          answer:
            "A lower gear makes the engine turn more times for each wheel rotation.",
        },
        title: "Why do motorcycles have a clutch and gears?",
        answer:
          "The clutch controls how much engine rotation reaches the gearbox. Gears change the relationship between engine speed and wheel speed.",
        explanation:
          "At a stop, the engine can run while the clutch is disengaged. As the clutch starts gripping, it transfers power gradually and lets the bike pull away. First gear trades wheel speed for more turning force, much like a bicycle's easy climbing gear. Higher gears allow more wheel speed for the same engine speed.",
        takeaway:
          "Think of pulling away and cruising as two different jobs. First gear suits the first job because getting a stationary bike moving takes more turning force.",
        question:
          "Why can the engine keep running while the bike is stopped in gear?",
        quizAnswer:
          "Disengaging the clutch interrupts the connection between the engine and gearbox.",
        reference: "Motorcycle Safety Foundation rider resources",
        url: "https://msf-usa.org/",
      },
      {
        slug: "brakes-and-abs",
        followUp: {
          question: "Why can an ABS brake lever or pedal pulse?",
          answer:
            "You can sometimes feel the system repeatedly reducing and rebuilding pressure while it controls wheel slip.",
        },
        title: "How do brakes and ABS work?",
        answer:
          "Brakes slow the wheels by friction. An anti-lock braking system (ABS) reduces the chance that a wheel locks during hard braking.",
        explanation:
          "On a disc brake, the lever or pedal typically builds hydraulic pressure, pressing pads against a disc that turns with the wheel. The friction turns motion into heat. ABS sensors monitor wheel speed. If a wheel is about to lock, the system briefly reduces and reapplies brake pressure. The tyres still need grip to slow the vehicle.",
        takeaway:
          "Find the brake disc and the caliper that grips it on a parked vehicle. Check the owner's manual to learn whether your vehicle has ABS.",
        question: "What does ABS monitor to detect possible wheel lock?",
        quizAnswer: "Wheel speed.",
        reference: "Insurance Institute for Highway Safety on motorcycles",
        url: "https://www.iihs.org/topics/motorcycles",
      },
      {
        slug: "tyre-pressure",
        followUp: {
          question: "Why does pressure fall even without a visible puncture?",
          answer:
            "Air can slowly escape through the tyre or valve, and colder air also lowers the reading. A tyre losing pressure unusually quickly needs inspection.",
        },
        title: "What do tyre-pressure numbers mean?",
        answer:
          "Tyre pressure measures the force of the air inside the tyre per unit of area. A vehicle's recommended pressure often appears in PSI, bar, or kPa.",
        explanation:
          "As a tyre rolls, it flexes and warms up. The air inside warms too, so a reading after a drive can be higher than a reading taken cold. The vehicle maker chooses a recommended cold pressure for the load the tyre has to carry. The number moulded into the tyre sidewall may describe a maximum or load rating.",
        takeaway:
          "Find the recommended cold pressures in the owner's manual or on the vehicle placard. Front and rear tyres can have different targets.",
        question: "Which number should you use for a routine pressure check?",
        quizAnswer: "The vehicle maker's recommended cold tyre pressure.",
        reference: "NHTSA tyre guidance",
        url: "https://www.nhtsa.gov/vehicle-safety/tires",
      },
      {
        slug: "oil-and-coolant",
        followUp: {
          question: "Why might an engine overheat even with enough coolant?",
          answer:
            "The coolant needs to circulate and release heat. A failed fan, pump, or thermostat can break that process.",
        },
        title: "What do engine oil and coolant do?",
        answer:
          "Engine oil lubricates moving parts. In a liquid-cooled engine, coolant carries heat to the radiator.",
        explanation:
          "An oil pump circulates oil through parts like the crankshaft bearings, where a thin film reduces metal-to-metal contact. Meanwhile, coolant passes through passages around the hot engine. In the radiator, heat flows from the coolant into the air. Some bikes use airflow over metal fins for cooling.",
        takeaway:
          "Use the owner's manual to identify your engine's cooling type and the exact oil specification. Check coolant only as the manual directs and leave a hot radiator cap closed.",
        question: "Which fluid separates moving surfaces with a thin film?",
        quizAnswer: "Engine oil.",
        reference: "Honda powersports owner's manuals",
        url: "https://powersports.honda.com/downloads/owners-manuals",
      },
      {
        slug: "electric-car",
        followUp: {
          question:
            "Why might regenerative braking weaken with a full battery?",
          answer:
            "The battery may have little room to accept more energy. Its temperature can also limit how much power it can take.",
        },
        title: "How does an electric car move?",
        answer:
          "A battery supplies electricity to a motor, which turns the wheels through a drivetrain.",
        explanation:
          "In many electric cars, an inverter changes the battery's direct current into controlled alternating current for the motor. The motor uses magnetic forces to turn a shaft. During regenerative braking, the wheels can turn the motor so it acts like a generator and sends some energy back to the battery.",
        takeaway:
          "When comparing EVs, read the range estimate and charging rate separately. One helps estimate how far you can travel, and the other helps estimate how long a charging stop may take.",
        question:
          "What happens to some of the car's motion during regenerative braking?",
        quizAnswer:
          "The motor converts it into electrical energy that can recharge the battery.",
        reference: "Alternative Fuels Data Center on electric cars",
        url: "https://afdc.energy.gov/vehicles/how-do-all-electric-cars-work",
      },
      {
        slug: "used-vehicle",
        followUp: {
          question: "Why ask to see the engine start cold?",
          answer:
            "Some starting problems, warning lights, and unusual sounds are easier to notice before an engine has warmed up.",
        },
        title: "What should you check before buying a used vehicle?",
        answer:
          "Check the paperwork, service history, condition, and likely repair costs before paying.",
        explanation:
          "Match the vehicle identification or chassis number to its documents. A service history can show whether regular work was done, while a test drive can uncover steering, braking, or shifting problems. An independent mechanic can inspect areas that are hard to judge from a listing or short drive.",
        takeaway:
          "Compare the full cost of two vehicles, including any tyres, brakes, insurance, or transfer fees you may need to pay for soon. Check ownership and finance status through the relevant local service.",
        question:
          "Why get an independent inspection when a vehicle looks clean?",
        quizAnswer: "Mechanical problems can be hidden from view.",
        reference: "FTC guide to buying a used car",
        url: "https://consumer.ftc.gov/articles/buying-used-car-dealer",
      },
    ],
  },
  {
    heading: "Phones and internet",
    id: "phones-and-internet",
    description: "Networks, batteries, maps and the web.",
    lessons: [
      {
        slug: "phone-call",
        followUp: {
          question: "Why can one person hear the other with a slight delay?",
          answer:
            "The phones and network spend time encoding, routing, and decoding the audio. Some calls also briefly buffer audio to smooth out uneven delivery.",
        },
        title: "How does a phone call reach someone?",
        answer:
          "Your phone converts your voice into digital data and sends it through a network to the other person's phone.",
        explanation:
          "On a mobile call, your microphone captures sound and a codec compresses it. A cell tower connects your phone to the carrier's network. The carrier finds the destination and routes the call, sometimes through another carrier. At the other end, the phone decodes the data and plays it through the speaker. Wi-Fi calling can use Wi-Fi for the first hop.",
        takeaway:
          "If calls fail in one room and work outside, signal coverage may explain the difference. Check whether your phone and carrier support Wi-Fi calling.",
        question: "What turns your voice into a signal the phone can process?",
        quizAnswer:
          "The microphone captures it, and the phone converts it into digital data.",
        reference: "Ofcom mobile phones guidance",
        url: "https://www.ofcom.org.uk/phones-and-broadband/mobile-phones",
      },
      {
        slug: "ram-and-storage",
        followUp: {
          question:
            "Why does an app sometimes reload even with plenty of free storage?",
          answer:
            "The phone can reclaim RAM from background apps. Free storage tells you how much space you have for saved data, which serves a different purpose.",
        },
        title: "What is the difference between RAM and storage?",
        answer:
          "RAM holds data a phone is actively using. Storage keeps apps, photos, and files between restarts.",
        explanation:
          "When you open a photo editor, the phone reads it from storage and uses RAM for the running app and the photo you're editing. If RAM gets crowded, the phone may close a background app, which then reloads when you return. Saving an edit writes the result back to storage.",
        takeaway:
          "If a phone says storage is full, review large videos, downloads, and apps. Check that important files are backed up before deleting them.",
        question: "Where does a saved photo live after a restart?",
        quizAnswer: "In storage.",
        reference: "Google Android guide to freeing up space",
        url: "https://support.google.com/android/answer/7431795",
      },
      {
        slug: "phone-battery",
        followUp: {
          question: "Why does a phone sometimes stop charging near 80 percent?",
          answer:
            "Some phones pause or limit charging intentionally to reduce time spent near full charge. Temperature can also cause charging to pause.",
        },
        title: "How does a phone battery charge and age?",
        answer:
          "A rechargeable lithium-ion battery stores energy through chemical changes. Its capacity gradually falls with use and age.",
        explanation:
          "During charging, lithium ions move through the battery toward one electrode. During use, they move back while electrons travel through the phone's circuits. Charging electronics control the current and voltage and typically slow charging as the battery fills. Heat can speed up the chemical changes that reduce capacity over time.",
        takeaway:
          "If your phone offers optimized charging, look for it in battery settings. Keep a charging phone out of hot surroundings such as a parked car in direct sun.",
        question: "Why might the last part of a charge take longer?",
        quizAnswer:
          "Charging electronics reduce the charging rate as the battery fills.",
        reference: "Apple on lithium-ion batteries",
        url: "https://www.apple.com/batteries/why-lithium-ion/",
      },
      {
        slug: "wifi-and-mobile-data",
        followUp: {
          question: "Why does Wi-Fi get worse through walls?",
          answer:
            "Walls absorb and reflect radio signals. The material, distance, and frequency all affect how much signal reaches the phone.",
        },
        title: "How do Wi-Fi and mobile data connect you to the internet?",
        answer:
          "Wi-Fi connects you by radio to a nearby router or access point. Mobile data connects you by radio to a carrier's cell tower.",
        explanation:
          "At home, your router typically sends traffic through a broadband provider. Outside, your phone can send the same requests through its mobile carrier. A strong Wi-Fi icon only tells you about the local link. The broadband line beyond the router can still be down.",
        takeaway:
          "If Wi-Fi shows full bars but pages won't load, check whether another device on the same Wi-Fi has the same problem. That helps narrow down where the connection failed.",
        question:
          "Can Wi-Fi have a strong signal while internet access is down?",
        quizAnswer:
          "Yes. The local wireless link can work while the router's internet connection fails.",
        reference: "Cisco on Wi-Fi",
        url: "https://www.cisco.com/c/en/us/products/wireless/what-is-wifi.html",
      },
      {
        slug: "gps",
        followUp: {
          question: "Why does my location jump around near tall buildings?",
          answer:
            "Reflections can make satellite signals travel farther before arriving. That can distort the distance estimates used to calculate your position.",
        },
        title: "How does GPS know where you are?",
        answer:
          "Your phone estimates its location by listening to timed signals from satellites.",
        explanation:
          "Each satellite broadcasts its position and the time its signal was sent. Your receiver uses signal travel times to estimate how far away the satellites are. A typical fix uses at least four satellites to solve for three-dimensional position and correct the phone's clock error. Buildings can block or reflect signals, so phones often combine GPS with Wi-Fi, cell signals, and other sensors.",
        takeaway:
          "Download an offline map before a trip with weak mobile coverage. Satellite positioning can work offline, while map images and traffic data need to be available separately.",
        question:
          "Does your phone need to transmit to a GPS satellite to find its position?",
        quizAnswer: "No. It receives signals from satellites.",
        reference: "GPS.gov on the GPS system",
        url: "https://www.gps.gov/gps",
      },
      {
        slug: "website-loading",
        followUp: {
          question: "Why can a site still fail when DNS works?",
          answer:
            "DNS can return a valid address while the server has an outage, the connection times out, or certificate verification fails.",
        },
        title: "What happens when you open a website?",
        answer:
          "Your browser finds a server, asks for the page, and turns the response into what you see on screen.",
        explanation:
          "DNS usually translates the website name into an IP address. For an HTTPS site, the browser establishes an encrypted connection and checks the server's certificate. It sends an HTTP request, receives HTML, and may make more requests for styles, images, and scripts. A cache can let the browser reuse files it already has.",
        takeaway:
          "If the words load before the pictures, you've seen separate requests finish at different times. A browser can start showing the page while other files arrive.",
        question: "What is DNS used for when opening a website?",
        quizAnswer:
          "Finding the network address associated with its domain name.",
        reference: "MDN on how the web works",
        url: "https://developer.mozilla.org/en-US/docs/Learn_web_development/Getting_started/Web_standards/How_the_web_works",
      },
      {
        slug: "backups-and-2fa",
        followUp: {
          question:
            "What if the phone that generates my sign-in codes is lost?",
          answer:
            "Use a recovery method you set up beforehand, such as securely stored recovery codes or a registered spare key. The options depend on the service.",
        },
        title: "What do backups and two-factor authentication protect?",
        answer:
          "A backup lets you recover data. Two-factor authentication (2FA) makes account sign-in harder for someone who has your password.",
        explanation:
          "A phone backup can restore photos or settings after a device breaks, depending on what the backup includes. A sync service may copy a deletion across devices, so check whether it also keeps older copies. With 2FA, a sign-in may require a second proof, such as a security key or an authenticator code.",
        takeaway:
          "Check the date of your last backup and which files it covers. Keep account recovery codes somewhere you can reach if your phone is lost.",
        question: "Which feature helps restore files after a phone breaks?",
        quizAnswer: "A backup that includes the files.",
        reference: "CISA advice on multifactor authentication",
        url: "https://www.cisa.gov/secure-our-world/turn-mfa",
      },
    ],
  },
  {
    heading: "Home and appliances",
    id: "home-and-appliances",
    description: "What makes appliances, power and water systems work.",
    lessons: [
      {
        slug: "refrigerator",
        followUp: {
          question:
            "Why does leaving the fridge door open warm the room overall?",
          answer:
            "The fridge returns the heat it extracts and adds the heat from the electrical energy it consumes.",
        },
        title: "How does a fridge stay cold?",
        answer:
          "A fridge moves heat from the inside of the cabinet into the room.",
        explanation:
          "A refrigerant evaporates in a coil inside the fridge, absorbing heat. The compressor raises its pressure and temperature. In a coil outside the cold compartment, the refrigerant releases heat and condenses. Its pressure then drops before it returns to the inside coil. Insulation and door seals slow the flow of heat back in.",
        takeaway:
          "If the cabinet seems warmer than usual, start by checking that the door closes fully and the seal is clean. A damaged seal lets warm air in.",
        question: "Why can the back or sides of a fridge feel warm?",
        quizAnswer:
          "The fridge releases heat from the cabinet, plus heat from running the system, into the room.",
        reference: "U.S. Department of Energy on heat pumps and refrigeration",
        url: "https://www.energy.gov/energysaver/heat-pump-systems",
      },
      {
        slug: "air-conditioner",
        followUp: {
          question: "Why can an AC drip water outdoors on a humid day?",
          answer:
            "Moisture in indoor air condenses on the cold coil and leaves through a drain. Where it exits depends on the installation.",
        },
        title: "How does an AC cool a room?",
        answer:
          "An air conditioner transfers heat from indoor air to outdoor air and can remove moisture along the way.",
        explanation:
          "A fan blows room air over a cold refrigerant coil. The coil absorbs heat, and water vapour can condense on it and drain away. The compressor circulates refrigerant to the outdoor coil, where another fan helps release the heat outside.",
        takeaway:
          "A dirty filter can restrict the air moving across the indoor coil. Check the manual for the cleaning or replacement schedule.",
        question: "Where does the heat taken from the room go?",
        quizAnswer: "The outdoor unit releases it into the outside air.",
        reference: "U.S. Department of Energy on air conditioning",
        url: "https://www.energy.gov/energysaver/air-conditioning",
      },
      {
        slug: "induction-stove",
        followUp: {
          question: "Why might a compatible pan still fail to heat?",
          answer:
            "The cooktop may be unable to detect a small or off-centre pan. Check its minimum base size and position guidance.",
        },
        title: "How does an induction stove heat a pan?",
        answer:
          "An induction stove uses a changing magnetic field to generate heat in compatible cookware.",
        explanation:
          "Electric current in a coil under the cooktop creates a changing magnetic field. That field induces currents in the pan's base, and the metal's resistance turns electrical energy into heat. The hot pan then heats the food and can leave the glass warm after cooking.",
        takeaway:
          "Try a fridge magnet on the bottom of a cold pan. If it sticks firmly, the pan is likely compatible. Also check the cookware label and the stovetop's minimum pan size.",
        question:
          "Where does an induction cooktop generate most of its cooking heat?",
        quizAnswer: "In the pan's base.",
        reference: "ENERGY STAR on electric cooking products",
        url: "https://www.energystar.gov/products/electric_cooking_products",
      },
      {
        slug: "circuit-breaker",
        followUp: {
          question: "Why can the lights work when nearby sockets stop?",
          answer:
            "Lights and sockets can belong to separate circuits, so one breaker can open while the other circuits continue to work.",
        },
        title: "Why does a circuit breaker trip?",
        answer:
          "A circuit breaker cuts power when current becomes too high for the circuit.",
        explanation:
          "A heater and kettle running on the same circuit can draw more current than the wiring is designed to carry. That's an overload. A short circuit can create a sudden surge in current through an unintended low-resistance path. A breaker opens the circuit in either case. Some protective devices also detect current leaking to earth.",
        takeaway:
          "If an appliance keeps causing a breaker to trip, stop using it and have the appliance or circuit checked by a qualified electrician.",
        question: "What does the breaker physically do when it trips?",
        quizAnswer: "It opens the circuit and stops current from flowing.",
        reference: "Electrical Safety First on fuses and circuit breakers",
        url: "https://www.electricalsafetyfirst.org.uk/news-and-insights/electricity-made-easy/",
      },
      {
        slug: "water-purifier",
        followUp: {
          question:
            "Why can a filter need replacing even when water tastes fine?",
          answer:
            "Some contaminants have no noticeable taste, and a cartridge's capacity can be exhausted before you notice a change.",
        },
        title: "What does a water purifier remove?",
        answer:
          "What it removes depends on its treatment method and certification.",
        explanation:
          "A sediment filter traps particles such as sand. Activated carbon can reduce some chemicals and improve taste and smell. Reverse osmosis uses pressure to push water through a membrane that can reduce many dissolved substances. A UV unit can inactivate certain microorganisms when the system is designed and operated for that purpose.",
        takeaway:
          "Find what is in your water from a local report or water test. Then check the exact model's certified reduction claims and replacement schedule.",
        question:
          "Does a better taste tell you which contaminants were removed?",
        quizAnswer:
          "No. Check the model's certified claims or use an appropriate water test.",
        reference: "CDC guide to home water treatment",
        url: "https://www.cdc.gov/drinking-water/about/about-home-water-treatment-systems.html",
      },
      {
        slug: "washing-machine",
        followUp: {
          question: "Why can a washer shake hard during the spin?",
          answer:
            "An uneven load can bunch on one side of the drum. As it spins fast, that imbalance makes the machine vibrate.",
        },
        title: "How does a washing machine clean clothes?",
        answer:
          "Water, detergent, and drum movement loosen dirt. Rinsing carries it away, and spinning removes much of the remaining water.",
        explanation:
          "Detergent contains surfactants that help lift oils and soil from fabric into the wash water. Tumbling or agitation brings that water into contact with more of the fabric. The washer drains, rinses with fresh water, and spins the clothes against the perforated drum to drive water out.",
        takeaway:
          "Leave enough room for clothes to move and follow the detergent dose for the load. Overfilling the drum reduces movement and makes rinsing harder.",
        question: "What is the main job of the final spin?",
        quizAnswer: "To remove water from the clothes.",
        reference: "American Cleaning Institute laundry basics",
        url: "https://www.cleaninginstitute.org/cleaning-tips/clothes/laundry-basics",
      },
      {
        slug: "electricity-bill",
        followUp: {
          question: "Why can the bill rise when monthly usage hardly changes?",
          answer:
            "The price per kWh, fixed fees, billing period, or previous adjustments can change. Check the usage and charges separately.",
        },
        title: "How do you read an electricity bill?",
        answer:
          "Start with energy used in kilowatt-hours (kWh), then look at the rates, fixed charges, adjustments, and taxes.",
        explanation:
          "A 1,000-watt appliance running at full power for one hour uses 1 kWh. Your bill may apply one price to each unit, different prices to different blocks of use, or different prices by time of day. Fixed charges can apply even during a billing period when you use little electricity.",
        takeaway:
          "Compare kWh per day across bills with different billing periods. A 30-day bill with 150 kWh and a 25-day bill with 125 kWh both average 5 kWh per day.",
        question:
          "How much energy does a 500-watt appliance use in two hours at full power?",
        quizAnswer: "1 kWh.",
        reference:
          "U.S. Energy Information Administration on electricity units",
        url: "https://www.eia.gov/energyexplained/electricity/measuring-electricity.php",
      },
    ],
  },
  {
    heading: "Money, health and public services",
    id: "everyday-services",
    description: "Payments, labels, blood pressure and public services.",
    lessons: [
      {
        slug: "qr-payment",
        followUp: {
          question:
            "Why might your bank show a debit while the app says pending?",
          answer:
            "Different parts of the payment system can update at different times. Check the final status through your payment app or bank before trying again.",
        },
        title: "What happens when you pay by QR code?",
        answer:
          "The QR code supplies payment details. Your payment app shows them for confirmation and sends the instruction through the payment network.",
        explanation:
          "In India's UPI system, a shop's code typically identifies the recipient. Some codes also include the amount. Check the payee and amount on screen before authorising. Once the transaction is processed, the app shows its status and a transaction reference. A failed or pending payment can look different from a completed one.",
        takeaway:
          "If a payment is pending, check your app's transaction history before paying again. Keep your UPI PIN private.",
        question:
          "What should you verify after scanning and before authorising?",
        quizAnswer: "The recipient name and amount shown in your app.",
        reference: "NPCI overview of UPI",
        url: "https://www.npci.org.in/what-we-do/upi/product-overview",
      },
      {
        slug: "debit-and-credit",
        followUp: {
          question: "What does a card payment marked pending mean?",
          answer:
            "The merchant may have obtained authorisation while the final charge is still being processed. A hold can temporarily reduce your available balance or credit.",
        },
        title: "How do debit and credit cards differ?",
        answer:
          "A debit card uses money from your bank account. A credit card lets you borrow against a credit limit and repay the issuer later.",
        explanation:
          "A debit card purchase generally reduces your available bank balance. A credit card purchase adds to your card balance. The credit card statement lists what you owe and when it is due. Paying only the minimum generally leaves a balance that can accrue interest. Terms vary by card and transaction type.",
        takeaway:
          "On a credit card statement, find the full statement balance, minimum payment, and due date. Those three figures answer different questions.",
        question: "Which card normally draws directly on your bank balance?",
        quizAnswer: "A debit card.",
        reference: "Federal Trade Commission on credit and debit cards",
        url: "https://consumer.ftc.gov/credit-loans-debt",
      },
      {
        slug: "loan-interest",
        followUp: {
          question:
            "Why can two loans with the same interest rate cost different amounts?",
          answer:
            "Fees, term length, and repayment timing can change the total cost even when the quoted interest rate matches.",
        },
        title: "How does loan interest work?",
        answer:
          "Interest is the cost of borrowing. On a typical reducing-balance loan, each payment pays interest and reduces the borrowed amount, called principal.",
        explanation:
          "If you owe ₹10,000 at an annual interest rate of 12% and the lender uses a monthly rate of 1%, the first month's interest is ₹100 before fees. If ₹900 of your payment goes toward principal, the next month's interest is calculated on ₹9,100. The payment schedule shows how this split changes over time.",
        takeaway:
          "Compare the total amount due and any fees alongside the monthly payment. A longer term can lower the monthly payment while increasing the total interest.",
        question:
          "Why does interest usually shrink as you repay a reducing-balance loan?",
        quizAnswer:
          "It is calculated on the remaining principal, which gets smaller.",
        reference: "Consumer Financial Protection Bureau on loan amortization",
        url: "https://www.consumerfinance.gov/ask-cfpb/what-is-amortization-and-how-could-it-affect-my-auto-loan-en-771/",
      },
      {
        slug: "nutrition-label",
        followUp: {
          question:
            "What if only the serving size is listed and I want a fair comparison?",
          answer:
            "Divide the nutrient amount by the serving size in grams, then multiply by 100 to compare both products per 100 grams.",
        },
        title: "How do you read a nutrition label?",
        answer:
          "Check what quantity the numbers refer to, then compare them with how much you plan to eat.",
        explanation:
          "A label might list nutrients per serving, per 100 grams, or both. If a serving contains 8 grams of sugar and you eat two servings, that is 16 grams. Where a label lists added sugar separately, it tells you how much sugar was added during processing or preparation.",
        takeaway:
          "Use the per-100-gram column to compare similar products with different serving sizes. Use the serving information to estimate what you actually eat.",
        question:
          "If you eat half of a listed serving, how much of the listed sodium do you get?",
        quizAnswer: "Half the amount.",
        reference: "FDA guide to the Nutrition Facts label",
        url: "https://www.fda.gov/food/nutrition-facts-label/how-understand-and-use-nutrition-facts-label",
      },
      {
        slug: "blood-pressure",
        followUp: {
          question: "Why can consecutive readings differ?",
          answer:
            "Blood pressure changes naturally, and movement, speaking, arm position, or cuff fit can affect the measurement.",
        },
        title: "What do the two blood pressure numbers measure?",
        answer:
          "Blood pressure measures how strongly blood pushes against artery walls. The top number is systolic pressure, and the bottom number is diastolic pressure.",
        explanation:
          "Systolic pressure is the pressure when the heart contracts. Diastolic pressure is the pressure between beats as the heart relaxes. A cuff measures these in millimetres of mercury, written mmHg. Activity, posture, and cuff fit can affect a reading.",
        takeaway:
          "If you track readings at home, use a correctly fitting upper-arm cuff, sit quietly before measuring, and record both numbers. A clinician can help interpret the pattern over time.",
        question: "Which number describes pressure between heartbeats?",
        quizAnswer: "The bottom number, called diastolic pressure.",
        reference: "American Heart Association on blood pressure readings",
        url: "https://www.heart.org/en/health-topics/high-blood-pressure/understanding-blood-pressure-readings",
      },
      {
        slug: "tap-water",
        followUp: {
          question: "Why do some water towers sit high above the ground?",
          answer:
            "Water stored high up can flow downhill and supply pressure even when demand varies and pumps are cycling.",
        },
        title: "Where does tap water come from?",
        answer:
          "Water can come from a river, reservoir, or underground aquifer. Utilities treat and deliver it through a network of pipes.",
        explanation:
          "At many treatment plants, tiny particles are gathered into larger clumps so they can settle out. Filters remove more material, and disinfection controls harmful microbes. Pumps, elevated tanks, or gravity help maintain the pressure that delivers water to taps. The exact steps depend on the source and utility.",
        takeaway:
          "Look up your local utility's water quality report or ask where your supply comes from. A building with a private well or storage tank may have additional testing or maintenance needs.",
        question: "What is the purpose of disinfection during water treatment?",
        quizAnswer: "To kill or inactivate harmful microorganisms.",
        reference: "CDC on how water treatment works",
        url: "https://www.cdc.gov/drinking-water/about/how-water-treatment-works.html",
      },
      {
        slug: "waste-collection",
        followUp: {
          question:
            "Why do recycling programmes ask for containers to be empty?",
          answer:
            "Leftover food or liquid can soil other materials, especially paper, and make a load harder to process.",
        },
        title: "Where does rubbish go after collection?",
        answer:
          "Different streams may go to sorting facilities, composting or digestion plants, waste-to-energy facilities, or landfills.",
        explanation:
          "Recyclable materials may be sorted by magnets, machines, or workers before being sold for reprocessing. Separately collected food scraps can be composted or sent to a digester where microbes break them down. Mixed waste is handled according to local facilities and rules.",
        takeaway:
          "Check what your local collection accepts. A recycling symbol on a package identifies a material or indicates recyclability in some settings, while actual acceptance depends on your local program.",
        question:
          "Why might a package with a recycling symbol be rejected locally?",
        quizAnswer:
          "The local service may lack the equipment or market to process that material.",
        reference: "U.S. Environmental Protection Agency on recycling basics",
        url: "https://www.epa.gov/recycle/recycling-basics-and-benefits",
      },
    ],
  },
];

const newTopics: Topic[] = [
  {
    id: "nature-and-space",
    heading: "Nature and space",
    description: "The sky, the Moon, light and the ocean.",
    lessons: [
      {
        slug: "blue-sky",
        title: "Why is the sky blue and sunset orange?",
        answer:
          "Air scatters blue light more strongly than red light. At sunset, sunlight travels through more air before it reaches you.",
        explanation:
          "Sunlight contains a mix of colours. Tiny molecules scatter shorter wavelengths, including blue, more than longer wavelengths. When you look away from the Sun, much of the scattered light reaching you is blue. At sunset, more blue light scatters out of the direct beam on its long path through the atmosphere, leaving that beam richer in orange and red.",
        takeaway:
          "Compare the part of the sky near the horizon at sunset with the sky overhead. Look away from the Sun itself.",
        question: "Why does the sunlight near the horizon look redder?",
        quizAnswer:
          "More of its blue light has been scattered out of the line of sight.",
        followUp: {
          question: "Why can clouds look white?",
          answer:
            "Cloud droplets are much larger than air molecules and scatter visible colours more evenly. The combination looks white. Thick clouds can look grey because less light makes it through to the underside.",
        },
        reference: "NASA Space Place on the colour of the sky",
        url: "https://spaceplace.nasa.gov/blue-sky/en/",
      },
      {
        slug: "rainbows",
        title: "Why do rainbows form a curved band?",
        answer:
          "Each raindrop sends different colours back at slightly different angles. You see the drops that line up at the right angle from your point of view.",
        explanation:
          "Light bends as it enters a drop, reflects inside, and bends again on the way out. Different wavelengths bend by different amounts. For a primary rainbow, the brightest returning light comes from directions roughly 40 to 42 degrees from the point opposite the Sun. Those directions form a circle around that point.",
        takeaway:
          "Look for a rainbow when the Sun is behind you and rain is falling ahead. The lower the Sun, the higher the top of the rainbow can appear.",
        question: "What part of the sky should you look toward?",
        quizAnswer: "Look away from the Sun, toward illuminated rain.",
        followUp: {
          question: "Is a rainbow really a full circle?",
          answer:
            "It can be. From the ground, the horizon usually hides the bottom. From an aircraft, you may see the whole circle if there are droplets in the right directions.",
        },
        reference: "Met Office on rainbows",
        url: "https://weather.metoffice.gov.uk/learn-about/weather/optical-effects/rainbows",
      },
      {
        slug: "tides",
        title: "What makes sea levels rise and fall each day?",
        answer:
          "The Moon and the Sun pull on Earth and its oceans. Differences in that pull across Earth drive tides.",
        explanation:
          "The Moon pulls a little more strongly on the near side of Earth than it does on Earth's centre, and a little less strongly on the far side. This difference helps explain why an idealised tide has two bulges. As Earth rotates, coastlines move through the changing pattern. Real coastlines and ocean depths reshape it, so local tide times and heights vary.",
        takeaway:
          "If you visit a beach, check the local tide table. Tide times can shift considerably from one day to the next.",
        question: "Why can tides be larger around a new or full Moon?",
        quizAnswer:
          "The Sun, Moon, and Earth are nearly aligned, so the lunar and solar tidal effects reinforce each other.",
        followUp: {
          question: "Does every coast have two high tides each day?",
          answer:
            "No. Some places get one main high tide, and others get two of unequal height. The shape and depth of nearby ocean basins matter.",
        },
        reference: "NOAA on what causes tides",
        url: "https://oceanservice.noaa.gov/facts/tides.html",
      },
      {
        slug: "moon-phases",
        title: "Why does the Moon change shape?",
        answer:
          "The Moon's sunlit half stays lit as it orbits Earth. We see different amounts of that half from our changing viewing angle.",
        explanation:
          "Near a new Moon, the lit side mostly faces away from us. As the Moon moves around Earth, we see a crescent, then a half-lit disc called first quarter, then a gibbous Moon. At full Moon, almost all of the side facing Earth is illuminated. The visible lit portion then shrinks again.",
        takeaway:
          "Use a lamp as the Sun and a ball as the Moon. Hold the ball at arm's length and turn slowly to see the illuminated portion change.",
        question: "What creates the normal monthly phases?",
        quizAnswer: "The changing angle between the Sun, Earth, and Moon.",
        followUp: {
          question: "Why doesn't a full Moon always produce a lunar eclipse?",
          answer:
            "The Moon's orbit is tilted relative to Earth's orbit around the Sun. Most months the full Moon passes above or below Earth's shadow.",
        },
        reference: "NASA on Moon phases",
        url: "https://science.nasa.gov/moon/moon-phases/",
      },
    ],
  },
  {
    id: "travel-and-infrastructure",
    heading: "Travel and infrastructure",
    description: "How planes fly, trains stay apart and lifts find your floor.",
    lessons: [
      {
        slug: "airplane-lift",
        title: "How does a heavy airplane stay up?",
        answer:
          "Moving wings redirect air downward and create pressure differences. The resulting upward force is lift.",
        explanation:
          "A wing moving through air at a suitable angle shapes and turns the airflow. Pressure is typically lower above the wing and higher below it. Together these pressures produce a net upward force, while the wing sends air downward. The engines provide thrust to overcome drag and maintain the speed needed for lift.",
        takeaway:
          "Watch a wing near landing. Extended flaps help the wing produce the required lift at a lower flight speed.",
        question:
          "What force do the engines mainly provide during ordinary forward flight?",
        quizAnswer: "Thrust.",
        followUp: {
          question:
            "Why can't pilots just keep tilting the wing upward to get more lift?",
          answer:
            "Beyond a critical angle, airflow separates from the wing and lift drops sharply. This is an aerodynamic stall.",
        },
        reference: "NASA Glenn on lift",
        url: "https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/what-is-lift/",
      },
      {
        slug: "turbulence",
        title: "Why does an airplane suddenly shake in clear skies?",
        answer:
          "Turbulence is irregular air movement. Even clear air can contain currents that change sharply over a short distance.",
        explanation:
          "Wind can change speed or direction across jet-stream boundaries. Mountains can set up waves in the air downwind, and rising warm air can create bumps at lower altitudes. As the plane passes through these movements, the changing airflow changes the forces felt by the aircraft and its passengers.",
        takeaway:
          "Follow the crew's instructions and keep your seat belt fastened while seated. Some turbulence arrives with little warning.",
        question: "Can turbulence occur with no visible clouds?",
        quizAnswer:
          "Yes. Clear-air turbulence can occur near strong changes in wind speed or direction.",
        followUp: {
          question:
            "Is a bump the same as the plane dropping through empty space?",
          answer:
            "No. The plane is still flying through air. A sudden change in upward or downward acceleration can make the movement feel more dramatic than it looks from outside.",
        },
        reference: "FAA on turbulence",
        url: "https://www.faa.gov/travelers/fly_safe/turbulence",
      },
      {
        slug: "train-signals",
        title: "How do train signals keep trains apart?",
        answer:
          "Railways detect where trains are and restrict which tracks a train can enter or how fast it can approach.",
        explanation:
          "In a fixed-block system, the track is divided into sections. Equipment such as track circuits or axle counters can detect whether a section is occupied. A signalling system uses that information and the position of track switches to allow or deny movement. Depending on the railway, instructions appear beside the track, in the driver's cab, or both.",
        takeaway:
          "When watching from a public platform, notice how a signal can change after a train passes. The next train needs enough room to brake.",
        question: "Why can't trains rely on drivers seeing the train ahead?",
        quizAnswer:
          "Their stopping distance can be longer than the driver's useful line of sight.",
        followUp: {
          question:
            "What keeps two conflicting routes from being cleared together?",
          answer:
            "An interlocking checks conditions such as track occupancy and switch position before allowing a route to be set.",
        },
        reference: "Network Rail on signals and signalling",
        url: "https://www.networkrail.co.uk/stories/signals-explained/",
      },
      {
        slug: "lifts",
        title: "How does a lift know where to stop?",
        answer:
          "A controller tracks the lift car's position and uses sensors to line it up with the requested floor.",
        explanation:
          "A typical cable-driven lift moves its car using a motor, with a counterweight balancing some of the load. The controller uses position information to slow the car as it approaches the floor. Once it is in the correct zone and stopped, the door system can unlock and open safely.",
        takeaway:
          "Notice how the car slows before the floor, settles level with the landing, and then opens its doors. Those are separate controlled steps.",
        question: "What tells the system that it has reached the floor?",
        quizAnswer: "Position sensors and the controller.",
        followUp: {
          question:
            "Why can a lift pass my floor even though I pressed the button?",
          answer:
            "Many systems group stops by direction or assign the call to another car. A car already moving the opposite way can continue to finish its current stops.",
        },
        reference: "Otis on lift safety systems",
        url: "https://www.otis.com/en/us/tools-resources/high-rise-safety-systems/",
      },
    ],
  },
  {
    id: "everyday-technology",
    heading: "Everyday inventions",
    description: "Barcodes, QR codes, headphones and contactless cards.",
    lessons: [
      {
        slug: "barcodes",
        title: "How does a barcode tell a shop what an item is?",
        answer:
          "A scanner reads a pattern representing an identifier. The shop looks up the product and price in its own database.",
        explanation:
          "In a common retail barcode, the widths of bars and spaces encode digits. A laser scanner or camera reads that pattern, and the checkout uses the resulting number to find the matching item record. A check digit helps detect some reading and entry errors.",
        takeaway:
          "Compare the printed digits on two different packet sizes of the same product. The shop typically needs a different identifier for each size.",
        question:
          "Where does a typical checkout get the current selling price?",
        quizAnswer: "From the shop's system using the identifier it scanned.",
        followUp: {
          question: "Why can a cashier type the digits if the scanner fails?",
          answer:
            "The digits printed beneath a typical retail barcode represent the same identifier encoded in the bars.",
        },
        reference: "GS1 on barcodes",
        url: "https://www.gs1.org/standards/barcodes",
      },
      {
        slug: "qr-codes",
        title: "How can a camera read a QR code from different angles?",
        answer:
          "A QR code has three large corner markers. The reader uses them to find the code and work out its orientation and shape.",
        explanation:
          "A camera captures a grid of dark and light squares. The reader locates the markers, accounts for rotation and perspective, and decodes the grid into data such as text or a link. Extra error-correction data can help recover the message if part of the pattern is damaged.",
        takeaway:
          "Try tilting a QR code for a web address you already know. At a steep angle or in poor lighting, the camera may have too little detail to read it.",
        question: "What helps the reader tell which way the code is tilted?",
        quizAnswer: "The large corner markers provide fixed reference points.",
        followUp: {
          question: "Why do some codes still scan with a logo in the middle?",
          answer:
            "The error-correction data can reconstruct some missing parts. Large damage, poor contrast, or damage to important markers can still stop it from scanning.",
        },
        reference: "DENSO WAVE on QR code features",
        url: "https://www.qrcode.com/en/about/",
      },
      {
        slug: "noise-cancelling",
        title: "How do noise-cancelling headphones quiet a room?",
        answer:
          "Microphones pick up surrounding sound. The headphones generate another sound wave that reduces it near your ears.",
        explanation:
          "When a pressure peak meets a similar pressure dip, the two can partly cancel. The headphones estimate what sound will reach the ear and produce a timed opposing signal through their speakers. Ear cups or tips add passive isolation by blocking some outside sound physically.",
        takeaway:
          "Compare noise cancelling with a steady fan and with a nearby conversation. The fan is usually easier to reduce.",
        question: "Why does active noise cancellation help on planes?",
        quizAnswer:
          "It works well against much of the steady, low-frequency engine and cabin sound.",
        followUp: {
          question: "Why can I still hear speech?",
          answer:
            "Speech changes quickly and includes higher frequencies, where small timing and positioning errors matter more. A well-sealed ear cup or tip can help.",
        },
        reference: "Sony on how noise cancellation works",
        url: "https://www.sony.com/electronics/support/articles/00203389",
      },
      {
        slug: "contactless-cards",
        title: "How does a card pay when you tap it?",
        answer:
          "The payment terminal and the card exchange short-range radio signals. The card can use energy from the terminal's field to respond.",
        explanation:
          "A terminal generates a field near its reader. The card's antenna and chip use that field to communicate payment information, including transaction-specific security data in typical chip payments. The terminal sends the payment for processing. The reader's confirmation tells you the tap was received, and the payment result tells you whether it was approved.",
        takeaway:
          "Look for the contactless symbol on the terminal and use its prompts to check the amount and result.",
        question: "Does a plastic contactless card need a battery?",
        quizAnswer:
          "No. It can draw power from the reader's field during the tap.",
        followUp: {
          question: "Why can a terminal ask for a PIN after a tap?",
          answer:
            "The card issuer, terminal, or payment rules can require extra verification depending on the purchase or other risk checks.",
        },
        reference: "EMVCo on contactless chip payments",
        url: "https://www.emvco.com/emv-technologies/emv-contactless-chip/",
      },
    ],
  },
];

export const topics = [...newTopics, ...originalTopics];
export const blogPath = (slug: string) => `/blog/${slug}`;

export const blogSlugs = topics.flatMap((topic) => [
  topic.id,
  ...topic.lessons.map((lesson) => lesson.slug),
]);

export function findLesson(slug: string) {
  for (const topic of topics) {
    const index = topic.lessons.findIndex((lesson) => lesson.slug === slug);
    if (index !== -1) {
      return {
        topic,
        lesson: topic.lessons[index],
        previous: topic.lessons[index - 1],
        next: topic.lessons[index + 1],
      };
    }
  }
}
