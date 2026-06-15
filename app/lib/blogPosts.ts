export const siteUrl = "https://gigaxios.com";

export type BlogSection = {
  id: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
};

export type BlogFaq = {
  question: string;
  answer: string;
};

export type BlogPost = {
  title: string;
  slug: string;
  description: string;
  publishDate: string;
  updatedDate?: string;
  category: string;
  readTime: string;
  keywords: string[];
  seoTitle: string;
  seoDescription: string;
  intro: string[];
  sections: BlogSection[];
  faqs?: BlogFaq[];
};

export const blogPosts: BlogPost[] = [
  {
    title:
      "How Much Do Gig Drivers Really Make After Gas, Mileage, and Vehicle Expenses?",
    slug: "how-much-do-gig-drivers-really-make",
    description:
      "A plain-English guide to calculating real gig driver profit after gas, mileage, maintenance, and vehicle expenses.",
    publishDate: "2026-06-15",
    updatedDate: "2026-06-15",
    category: "Profit Tracking",
    readTime: "7 min read",
    keywords: [
      "how much do gig drivers make",
      "gig driver profit",
      "delivery driver expenses",
      "net profit for gig workers",
    ],
    seoTitle:
      "How Much Do Gig Drivers Really Make After Expenses? | GigAxios",
    seoDescription:
      "Learn how to calculate real gig driver income after gas, mileage, maintenance, and vehicle expenses so gross pay does not mislead you.",
    intro: [
      "Most gig apps make it easy to see gross pay. That number matters, but it is not the same thing as profit. If you drive for DoorDash, Uber Eats, Spark, Instacart, Shipt, GoPuff, Roadie, or other platforms, your car is part of the job.",
      "Real gig income starts after you subtract fuel, mileage, service, repairs, and the other costs that show up because you drove. GigAxios is built around that difference: gross pay is what came in, net profit is what you actually kept.",
    ],
    sections: [
      {
        id: "gross-pay-vs-profit",
        title: "Gross Pay Is Only the Starting Point",
        paragraphs: [
          "Gross pay is the amount the platform says you earned before expenses. It may include base pay, tips, incentives, promotions, or adjustment pay. It does not include what you spent to complete the work.",
          "That is why two drivers can have the same gross pay and very different outcomes. A driver who earns $120 on short, efficient routes may keep much more than a driver who earns $120 after long drives, idle time, and extra fuel stops.",
        ],
        bullets: [
          "Gross pay: money earned before expenses",
          "Net profit: money left after expenses",
          "Profit per mile: net profit divided by work miles",
        ],
      },
      {
        id: "expenses-to-track",
        title: "The Expenses Gig Drivers Should Track",
        paragraphs: [
          "Fuel is the expense drivers notice first, but it is not the only one. Every work mile adds wear to tires, brakes, oil, suspension, and other parts. Some costs happen daily, while others arrive later as maintenance or repairs.",
          "A simple tracking habit helps you avoid surprises. You do not need a complicated spreadsheet to start. You need a consistent record of mileage, fuel, vehicle expenses, and what each shift actually paid.",
        ],
        bullets: [
          "Gas or charging costs",
          "Business miles driven for each shift",
          "Oil changes, tires, brakes, and maintenance",
          "Parking, tolls, car washes, and supplies",
          "Phone mounts, hot bags, and other work gear",
        ],
      },
      {
        id: "simple-formula",
        title: "A Simple Real Profit Formula",
        paragraphs: [
          "The basic formula is straightforward: gross earnings minus work expenses equals real net profit. The hard part is remembering to capture the numbers while you are busy driving.",
          "For example, if a shift pays $115 and you spend $18 on fuel, your quick cash result is $97. But if that shift also added 95 work miles, you still need to account for vehicle wear and future service costs. That is where mileage tracking gives you a clearer picture.",
        ],
        bullets: [
          "Gross earnings - fuel costs = quick cash result",
          "Quick cash result - vehicle costs = better net profit estimate",
          "Net profit / hours worked = real hourly result",
          "Net profit / miles driven = route efficiency",
        ],
      },
      {
        id: "why-mileage-changes-everything",
        title: "Why Mileage Changes the Story",
        paragraphs: [
          "Mileage is one of the most important numbers for gig drivers because it connects your income to the vehicle cost of earning it. A high-paying order may look good until you compare it with the miles required.",
          "Tracking beginning and ending odometer readings for each shift gives you a practical record. It helps you understand which apps, zones, days, and routes are producing money instead of simply keeping you busy.",
        ],
      },
      {
        id: "use-gigaxios",
        title: "How GigAxios Helps",
        paragraphs: [
          "GigAxios helps drivers track the pieces that matter together: mileage, fuel, vehicle expenses, tips, and net profit. Instead of reviewing income in one app, fuel in another place, and maintenance from memory, you can see the shift as a business result.",
          "The goal is not to make driving feel more complicated. The goal is to make the truth easier to see so you can decide which work is worth repeating.",
        ],
      },
    ],
    faqs: [
      {
        question: "What is a good profit number for gig driving?",
        answer:
          "It depends on your market, vehicle, schedule, and platform mix. A better habit is to compare net profit per hour and net profit per mile over time.",
      },
      {
        question: "Should gig drivers track miles daily?",
        answer:
          "Yes. Daily or shift-level mileage records are usually easier and more accurate than trying to reconstruct miles later.",
      },
    ],
  },
  {
    title: "The 3 Photos a Day Method for Tracking Gig Driver Income",
    slug: "3-photos-a-day-gig-driver-tracking",
    description:
      "A simple daily tracking method for gig drivers using three photos: starting odometer, ending odometer, and receipts.",
    publishDate: "2026-06-15",
    updatedDate: "2026-06-15",
    category: "Driver Habits",
    readTime: "6 min read",
    keywords: [
      "gig driver tracking method",
      "track gig income",
      "delivery driver mileage tracking",
      "odometer photos",
    ],
    seoTitle: "The 3 Photos a Day Gig Driver Tracking Method | GigAxios",
    seoDescription:
      "Use three quick photos a day to track mileage, fuel receipts, and real gig driver profit with less manual work.",
    intro: [
      "The best tracking system is the one you will actually use after a long shift. For many gig drivers, that means making the habit quick enough to fit between orders, fuel stops, and the end of the day.",
      "The 3 Photos a Day Method is simple: take one photo before you start, one when you finish, and one whenever you buy fuel or pay a work-related vehicle expense.",
    ],
    sections: [
      {
        id: "why-photos-work",
        title: "Why Photos Work for Busy Drivers",
        paragraphs: [
          "Typing every number by hand can become a chore. Photos create a timestamped reminder and reduce the chance that you forget the details later.",
          "A photo habit also works across platforms. Whether you drove for DoorDash in the morning, Spark in the afternoon, and Uber Eats at night, your odometer still tells the mileage story.",
        ],
      },
      {
        id: "photo-one",
        title: "Photo 1: Starting Odometer",
        paragraphs: [
          "Before you accept your first order or head toward your work zone, take a clear picture of your odometer. This becomes the starting point for your business miles.",
          "If you drive personal miles before starting work, take the photo only when the work portion begins. The cleaner the habit, the cleaner your numbers.",
        ],
      },
      {
        id: "photo-two",
        title: "Photo 2: Ending Odometer",
        paragraphs: [
          "When you stop working, take another odometer photo. The difference between the starting and ending readings gives you the miles tied to that shift.",
          "This is especially useful when you switch between apps. You may not remember every route, but the odometer records the total driving needed to earn that day's income.",
        ],
      },
      {
        id: "photo-three",
        title: "Photo 3: Fuel or Expense Receipt",
        paragraphs: [
          "Any time you buy gas, pay for a car wash, replace wiper blades, or handle another work-related vehicle expense, take a receipt photo before it disappears into a cup holder or trash bag.",
          "The receipt gives you the amount, merchant, and date. Later, you can connect that cost to your real gig work profit instead of guessing from memory.",
        ],
        bullets: [
          "Fuel receipts",
          "Maintenance and repair receipts",
          "Tolls or parking receipts",
          "Work supplies such as insulated bags or phone mounts",
        ],
      },
      {
        id: "using-gigaxios",
        title: "Turning Photos Into Profit Tracking",
        paragraphs: [
          "GigAxios is designed for this kind of practical tracking. It helps you record odometer readings, fuel costs, vehicle expenses, and income so your day turns into a clear profit picture.",
          "The habit is small, but the insight compounds. After a few weeks, you can see which days are worth driving, which routes burn too much fuel, and whether your gross pay is translating into real net profit.",
        ],
      },
    ],
    faqs: [
      {
        question: "Do I need photos if I already write down mileage?",
        answer:
          "Not necessarily, but photos can make the habit easier and provide a helpful backup when you are tired or switching between apps.",
      },
      {
        question: "Can this work for multiple vehicles?",
        answer:
          "Yes. Just make sure each shift is tied to the vehicle you used so mileage and expenses stay organized.",
      },
    ],
  },
  {
    title: "Best Mileage Tracking App for Gig Drivers in 2026",
    slug: "best-mileage-tracking-app-for-gig-drivers",
    description:
      "What gig drivers should look for in a mileage tracking app in 2026, from odometer records to fuel and net profit tracking.",
    publishDate: "2026-06-15",
    updatedDate: "2026-06-15",
    category: "Mileage Tracking",
    readTime: "8 min read",
    keywords: [
      "best mileage tracking app for gig drivers",
      "mileage tracker 2026",
      "delivery driver mileage app",
      "gig driver expense tracker",
    ],
    seoTitle: "Best Mileage Tracking App for Gig Drivers in 2026 | GigAxios",
    seoDescription:
      "Compare what matters in a gig driver mileage tracking app: shift miles, fuel, vehicle expenses, multiple vehicles, and real net profit.",
    intro: [
      "The best mileage tracking app for gig drivers is not just the one that records miles. It is the one that helps you understand what those miles cost and whether the work was actually profitable.",
      "In 2026, drivers need a tool that fits how gig work really happens: multiple apps, flexible shifts, fuel swings, vehicle wear, and income that can look better before expenses than after them.",
    ],
    sections: [
      {
        id: "what-matters",
        title: "What Matters Most in a Mileage Tracker",
        paragraphs: [
          "A mileage tracker should make it easy to capture work miles consistently. For gig drivers, that often means tracking by shift instead of trying to sort everything out at tax time.",
          "The app should also help you connect miles to income. A mileage number alone is useful, but profit per mile is far more actionable when you are deciding where and when to drive.",
        ],
        bullets: [
          "Fast shift-based mileage entry",
          "Beginning and ending odometer support",
          "Fuel and vehicle expense tracking",
          "Multiple vehicle support",
          "Clear net profit views",
        ],
      },
      {
        id: "automatic-vs-manual",
        title: "Automatic Tracking vs. Odometer-Based Tracking",
        paragraphs: [
          "Automatic mileage tracking can be convenient, but it may not fit every driver or every phone setup. Some drivers prefer odometer-based tracking because it is simple, visible, and easy to verify.",
          "The right choice depends on your habits. If you trust yourself to take quick odometer readings, a shift-based method can be reliable without running location tracking in the background.",
        ],
      },
      {
        id: "beyond-taxes",
        title: "Mileage Tracking Is Not Only for Taxes",
        paragraphs: [
          "Tax records are important, but drivers also need operational feedback. You want to know whether a lunch shift, late-night run, shopping batch, or route-heavy delivery block was worth the miles.",
          "When you track miles alongside fuel and income, you can spot patterns: days that look busy but pay poorly, zones that require too much deadhead driving, and apps that perform better for your vehicle.",
        ],
      },
      {
        id: "why-gigaxios",
        title: "Why GigAxios Fits Gig Drivers",
        paragraphs: [
          "GigAxios focuses on the full driver picture: mileage, fuel, vehicle expenses, income, tips, and true net profit. It is built for people who drive across platforms and want plain-English numbers they can use.",
          "A good mileage app should answer more than 'How far did I drive?' It should help answer 'Was this shift worth it?' That is the question GigAxios is built around.",
        ],
      },
    ],
    faqs: [
      {
        question: "What is the best mileage tracking method for gig drivers?",
        answer:
          "The best method is one you can use every shift. Many drivers do well with beginning and ending odometer readings plus fuel and expense tracking.",
      },
      {
        question: "Should a mileage app track income too?",
        answer:
          "For gig drivers, yes. Mileage becomes more useful when it is connected to earnings and expenses so you can see net profit.",
      },
    ],
  },
  {
    title: "DoorDash Earnings Calculator: Calculate Your Real Profit",
    slug: "doordash-earnings-calculator",
    description:
      "Use this guide to calculate DoorDash profit after gas, mileage, vehicle expenses, and time on the road.",
    publishDate: "2026-06-15",
    updatedDate: "2026-06-15",
    category: "Calculators",
    readTime: "7 min read",
    keywords: [
      "DoorDash earnings calculator",
      "DoorDash profit calculator",
      "DoorDash expenses",
      "delivery driver net profit",
    ],
    seoTitle: "DoorDash Earnings Calculator: Real Profit Guide | GigAxios",
    seoDescription:
      "Calculate real DoorDash profit by subtracting fuel, mileage, vehicle expenses, and other costs from gross earnings.",
    intro: [
      "A DoorDash earnings calculator should do more than add up pay and tips. If it does not account for gas, mileage, and vehicle expenses, it can make a shift look more profitable than it really was.",
      "This guide shows a simple way to calculate real DoorDash profit. The same approach works for Uber Eats, Spark, Instacart, Shipt, GoPuff, Roadie, and other gig driving work.",
    ],
    sections: [
      {
        id: "numbers-needed",
        title: "The Numbers You Need",
        paragraphs: [
          "Start with the numbers you can collect every shift. You need what you earned, how long you worked, how many miles you drove, and what you spent to complete the work.",
          "Do not worry about building a perfect accounting system on day one. A consistent habit will beat a perfect plan you never use.",
        ],
        bullets: [
          "Gross DoorDash earnings",
          "Tips and promotional pay",
          "Start and end odometer readings",
          "Fuel purchased or estimated fuel used",
          "Vehicle expenses tied to the work",
          "Hours worked",
        ],
      },
      {
        id: "calculator-formula",
        title: "The Real Profit Formula",
        paragraphs: [
          "Use this formula: gross earnings minus fuel costs minus vehicle costs equals estimated net profit. Then divide that net profit by hours worked and miles driven.",
          "The result gives you two practical numbers: profit per hour and profit per mile. Both matter. A shift can look good per hour but poor per mile if it burns through your vehicle too quickly.",
        ],
        bullets: [
          "Net profit = gross earnings - fuel - vehicle expenses",
          "Profit per hour = net profit / hours worked",
          "Profit per mile = net profit / work miles",
        ],
      },
      {
        id: "example",
        title: "Example DoorDash Shift",
        paragraphs: [
          "Imagine a shift with $96 in gross earnings, 68 work miles, 4.5 hours worked, and $14 in fuel costs. Before counting vehicle wear, the quick result is $82.",
          "If you set aside money for tires, oil changes, brakes, and other maintenance, the real result is lower. That does not mean the shift was bad. It means you are finally measuring it honestly.",
        ],
      },
      {
        id: "avoid-common-mistakes",
        title: "Common Calculator Mistakes",
        paragraphs: [
          "The most common mistake is using platform earnings as profit. Another is tracking fuel but ignoring mileage. Fuel is immediate, while vehicle wear arrives later, which makes it easier to underestimate.",
          "Drivers also forget unpaid miles: driving to a hotspot, repositioning after an order, or returning from a far drop-off. Those miles still affect the value of the shift.",
        ],
      },
      {
        id: "gigaxios-calculator",
        title: "Use GigAxios to Track the Inputs",
        paragraphs: [
          "GigAxios helps you track the inputs behind a useful earnings calculator: mileage, fuel, vehicle expenses, tips, and net profit. Instead of doing the math from scattered notes, you can keep the numbers tied to your driving records.",
          "When you know your actual profit, you can make better decisions about which offers, zones, and schedules deserve your time.",
        ],
      },
    ],
    faqs: [
      {
        question: "Is DoorDash gross pay the same as profit?",
        answer:
          "No. Gross pay is before expenses. Profit is what remains after fuel, mileage-related costs, and other work expenses.",
      },
      {
        question: "Can this calculator approach work for other apps?",
        answer:
          "Yes. The same gross pay minus expenses formula works for most delivery, rideshare, shopping, and courier platforms.",
      },
    ],
  },
  {
    title: "Fuel Costs Are Destroying Gig Driver Profits",
    slug: "gig-driver-fuel-costs",
    description:
      "Fuel costs can quietly erase gig driver profits. Learn how to track gas, miles, and route efficiency before gross pay misleads you.",
    publishDate: "2026-06-15",
    updatedDate: "2026-06-15",
    category: "Fuel Costs",
    readTime: "6 min read",
    keywords: [
      "gig driver fuel costs",
      "delivery driver gas expenses",
      "fuel cost tracking",
      "gig driver profit",
    ],
    seoTitle: "Fuel Costs Are Destroying Gig Driver Profits | GigAxios",
    seoDescription:
      "Learn why fuel costs can erase gig driver profit and how to track gas, mileage, and net earnings more clearly.",
    intro: [
      "Fuel is one of the fastest ways gig driver profit disappears. A shift can feel strong when orders are coming in, then look much weaker after you fill the tank.",
      "The problem is not just high gas prices. The problem is driving without connecting fuel cost to earnings, miles, and the type of work you accepted.",
    ],
    sections: [
      {
        id: "fuel-is-not-flat",
        title: "Fuel Cost Is Not the Same for Every Shift",
        paragraphs: [
          "A $100 shift can have very different fuel costs depending on traffic, distance, vehicle efficiency, idle time, and how often you reposition between orders.",
          "That is why averages can be misleading. Your market may have some shifts that are fuel efficient and others where long drop-offs quietly eat the profit.",
        ],
      },
      {
        id: "track-fuel-with-miles",
        title: "Track Fuel With Miles, Not by Itself",
        paragraphs: [
          "Fuel receipts are useful, but they tell only part of the story. To understand whether fuel is hurting your profit, connect fuel spending to the miles and earnings from the same driving period.",
          "When you track mileage and fuel together, you can see whether a busy day produced strong profit or simply moved money from the gig app to the gas pump.",
        ],
        bullets: [
          "Fuel spent per shift",
          "Work miles per shift",
          "Gross earnings per shift",
          "Net profit after fuel",
          "Profit per mile",
        ],
      },
      {
        id: "routes-that-burn-profit",
        title: "Routes That Burn Profit",
        paragraphs: [
          "Long-distance orders, far drop-offs, slow restaurant waits, and deadhead miles can all increase fuel cost. The same is true for shopping orders that require extra driving between stores and customers.",
          "This does not mean every long order is bad. It means the order needs enough pay to justify the distance, time, and vehicle cost.",
        ],
      },
      {
        id: "habits-that-help",
        title: "Habits That Help Protect Profit",
        paragraphs: [
          "Small habits can make fuel cost easier to manage. Track your starting and ending odometer, record fuel purchases, compare zones, and pay attention to profit per mile rather than only dollars per order.",
          "Over time, you will learn which work patterns are efficient for your vehicle and which ones look good only before expenses.",
        ],
      },
      {
        id: "gigaxios-fuel",
        title: "How GigAxios Helps With Fuel Tracking",
        paragraphs: [
          "GigAxios helps drivers record fuel purchases alongside mileage, income, tips, and vehicle expenses. That makes it easier to see real net profit after the cost of driving.",
          "Fuel costs are easier to manage when they are visible. GigAxios keeps them connected to the work that created them.",
        ],
      },
    ],
    faqs: [
      {
        question: "How often should gig drivers record fuel costs?",
        answer:
          "Record fuel costs whenever you buy fuel. Pairing receipts with mileage and income makes the numbers more useful.",
      },
      {
        question: "Is fuel the biggest gig driver expense?",
        answer:
          "Fuel is often the most visible expense, but maintenance, tires, depreciation, and repairs also matter when calculating real profit.",
      },
    ],
  },
];

export function getBlogPost(slug: string) {
  return blogPosts.find((post) => post.slug === slug);
}

export function getRelatedPosts(slug: string, limit = 3) {
  const currentPost = getBlogPost(slug);

  return blogPosts
    .filter((post) => post.slug !== slug)
    .sort((first, second) => {
      if (!currentPost) return 0;
      const firstCategoryMatch = first.category === currentPost.category ? 1 : 0;
      const secondCategoryMatch =
        second.category === currentPost.category ? 1 : 0;

      return secondCategoryMatch - firstCategoryMatch;
    })
    .slice(0, limit);
}

export function getPostUrl(slug: string) {
  return `${siteUrl}/blog/${slug}`;
}
