import type { Metadata } from "next";
import { Header } from "@/components/Header";
import styles from "./blog.module.css";

export const metadata: Metadata = {
  title: "Everyday Basics | Muzammil Patel",
  description:
    "Learn how motorcycles, phones, appliances, payments and other everyday things work in 28 short lessons.",
};

const topics = [
  {
    heading: "Vehicles",
    id: "vehicles",
    lessons: [
      {
        slug: "motorcycle",
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
    lessons: [
      {
        slug: "phone-call",
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
    lessons: [
      {
        slug: "refrigerator",
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
    lessons: [
      {
        slug: "qr-payment",
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

const allLessons = topics.flatMap(({ heading, id, lessons }) =>
  lessons.map((lesson) => ({ ...lesson, heading, categoryId: id })),
);

export default function Page() {
  return (
    <>
      <Header />
      <main id="main" className={styles.blog}>
        <header className={styles.intro}>
          <h1>Everyday Basics</h1>
          <p>28 short lessons on how the things you use every day work.</p>
        </header>

        <nav
          id="lesson-index"
          aria-label="Lesson categories"
          className={styles.categories}
        >
          <h2>Browse by topic</h2>
          <ul>
            {topics.map(({ heading, id }) => (
              <li key={id}>
                <a href={`#${id}`}>
                  {heading} <span aria-hidden="true">↓</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className={styles.index}>
          {topics.map(({ heading, id, lessons }) => (
            <section id={id} className={styles.category} key={id}>
              <h2>{heading}</h2>
              <ul>
                {lessons.map(({ slug, title }) => (
                  <li key={slug}>
                    <a href={`#${slug}`}>
                      {title} <span aria-hidden="true">→</span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div className={styles.reading}>
          {allLessons.map((lesson, index) => {
            const previous = allLessons[index - 1];
            const next = allLessons[index + 1];
            return (
              <article
                className={styles.lesson}
                key={lesson.slug}
                id={lesson.slug}
              >
                <a className={styles.back} href={`#${lesson.categoryId}`}>
                  ↑ Back to {lesson.heading.toLowerCase()}
                </a>
                <h2>{lesson.title}</h2>
                <p>
                  <strong>{lesson.answer}</strong>
                </p>
                <p>{lesson.explanation}</p>
                <p className={styles.takeaway}>
                  <strong>Try this.</strong> {lesson.takeaway}
                </p>
                <details className={styles.quiz}>
                  <summary>{lesson.question}</summary>
                  <p>{lesson.quizAnswer}</p>
                </details>
                <p className={styles.reference}>
                  <a href={lesson.url}>{lesson.reference}</a>
                </p>
                <nav
                  className={styles.lessonNav}
                  aria-label={`Navigation for ${lesson.title}`}
                >
                  {previous && (
                    <a href={`#${previous.slug}`}>
                      <span>← Previous lesson</span>
                      {previous.title}
                    </a>
                  )}
                  {next && (
                    <a href={`#${next.slug}`}>
                      <span>Next lesson →</span>
                      {next.title}
                    </a>
                  )}
                </nav>
                <a className={styles.back} href="#lesson-index">
                  ↑ All topics
                </a>
              </article>
            );
          })}
        </div>
      </main>
    </>
  );
}
