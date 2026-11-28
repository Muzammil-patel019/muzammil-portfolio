import type { Topic } from "./lessons";

const istqb =
  "https://istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf";

export const testingTopic: Topic = {
  id: "software-testing",
  heading: "Software testing",
  description:
    "Learn how people and code check a website, using one simple shopping-cart example.",
  lessons: [
    {
      slug: "what-is-software-testing",
      title: "What is software testing?",
      answer:
        "Testing is trying something, deciding what should happen, and checking what actually happens. Think of pushing a button on a toy and seeing whether the light comes on.",
      explanation:
        "Imagine a shop promises free delivery when your cart reaches ₹500. A tester checks ₹499, ₹500, and ₹501. These three amounts sit just below, at, and just above the point where the rule changes. This is called boundary value analysis. If the shop still charges ₹50 at exactly ₹500, the result disagrees with the promise. That gives you a specific problem to investigate.",
      figure: {
        src: "delivery-boundary.webp",
        alt: "Bar chart showing a ₹50 delivery fee for a ₹499 cart and a ₹0 fee for ₹500 and ₹501 carts.",
        caption:
          "The fee should drop from ₹50 to ₹0 at exactly ₹500. These are the expected results for our imaginary shop.",
      },
      followUp: {
        question: "If these three tests pass, is the shop bug-free?",
        answer:
          "Those results tell you the delivery rule worked for those amounts. A discount, a different address, or removing an item could still reveal a problem. Tests give evidence about the situations you checked.",
      },
      takeaway:
        "Pick a familiar rule, like a video being available from age 13. Write what you expect at ages 12, 13, and 14 before trying it.",
      question:
        "Which cart total is most likely to reveal a mistake in the exact cutoff?",
      quizAnswer:
        "₹500. A developer might accidentally write “more than ₹500” where the rule says “₹500 or more.”",
      reference: "ISTQB guide to test design and boundary values",
      url: istqb,
    },
    {
      slug: "manual-testing",
      title: "How do people test a website by hand?",
      answer:
        "In manual testing, a person uses the website and checks what happens, like trying the buttons on a new toy yourself.",
      explanation:
        "Some manual tests follow written steps so another person can repeat them. In exploratory testing, you learn while you test and choose what to try next. For the delivery rule, start with a ₹500 cart. Then remove an item and see whether the delivery fee returns. On a narrow phone, also check whether you can read the fee label and understand why the total changed.",
      figure: {
        src: "manual-check.webp",
        alt: "A tester looks at a phone showing a ₹500 cart and compares the free-delivery message with an expected ₹0 fee.",
        caption:
          "A person compares the screen with the rule and can also notice whether the message makes sense.",
      },
      walkthrough: [
        "Open the demo cart on a phone and add items totalling exactly ₹500.",
        "Expected result. The delivery fee shows ₹0 before payment.",
        "Example actual result. The delivery fee shows ₹50.",
        "Report what happened, the steps, the device and browser, and a screenshot without personal details.",
      ],
      followUp: {
        question: "When is a person especially helpful?",
        answer:
          "A person can notice confusion, awkward wording, or something odd that suggests a new check. For example, the total may be mathematically correct while shoppers still cannot tell what they will pay.",
      },
      takeaway:
        "On a demo site, try one written test, then change one detail you are curious about. Record the expected and actual results separately.",
      question:
        "What makes a report more useful than saying “delivery is broken”?",
      quizAnswer:
        "Give repeatable steps, the exact cart total, what you expected, and what appeared on screen.",
      reference: "ISTQB guide to exploratory testing and defect reports",
      url: istqb,
    },
    {
      slug: "automation-testing",
      title: "How does a computer test a website?",
      answer:
        "An automated test is a set of instructions the computer can repeat. You tell it what to do and what result counts as passing.",
      explanation:
        "A tool like Playwright can open a browser, find a button, click it, and read what the page shows. The expected-result check is called an assertion. In this example, the cart is prepared with ₹500 of items. The test checks that the delivery fee text is exactly ₹0 and reports a failure if it sees ₹50.",
      figure: {
        src: "automation-loop.webp",
        alt: "An illustrated robot follows written steps, opens a browser cart, checks for a zero delivery fee, and reports pass or fail.",
        caption:
          "The runner repeats the steps and reports what the assertion found.",
      },
      code: {
        label:
          "Example Playwright test for an imaginary shop. It assumes a test cart URL and a Delivery fee field with the matching test ID.",
        snippet: `import { test, expect } from "@playwright/test";

test("delivery is free at ₹500", async ({ page }) => {
  await page.goto("https://demo.example/cart?subtotal=500");
  await expect(page.getByTestId("delivery-fee")).toHaveText("₹0");
});`,
      },
      followUp: {
        question:
          "Does a failed automated test always mean the website is broken?",
        answer:
          "A failure can come from the website, the test instructions, missing sample data, or an unavailable environment. Compare the expected and actual results and inspect the error before deciding what needs fixing.",
      },
      takeaway:
        "Read the two lines inside the test. The first sets up the scenario. The second compares what the browser displays with what you expect.",
      question: "What would make this test fail if the cart opens correctly?",
      quizAnswer:
        "If the delivery fee field cannot be found or its text does not become ₹0, the assertion fails.",
      reference: "Playwright’s guide to writing tests",
      url: "https://playwright.dev/docs/writing-tests",
    },
    {
      slug: "manual-vs-automation",
      title: "When should you test by hand or automate?",
      answer:
        "Test by hand when you’re learning what matters. Automate stable checks that you expect to repeat many times.",
      explanation:
        "Suppose a person spends 5 minutes checking the delivery rule each time. An automated version takes 20 minutes to write and 1 minute for each run. After 5 runs, each approach totals 25 minutes in this example. After 10 runs, the manual checks total 50 minutes and the automated approach totals 30. A real estimate also depends on maintenance, investigation, and whether the machine can run unattended.",
      figure: {
        src: "repeat-cost.webp",
        alt: "Line chart of total minutes. Manual starts at zero and rises five minutes per run. Automation starts at 20 minutes and rises one minute per run. Both reach 25 minutes at five runs.",
        caption:
          "Illustration only. This example measures total elapsed minutes and assumes no maintenance.",
      },
      walkthrough: [
        "Explore the new checkout by hand and find where users get confused.",
        "Agree on the rules, such as free delivery at ₹500.",
        "Automate those repeatable rules and run the checks after later changes. This is called regression testing.",
        "Keep exploring new designs and unusual situations by hand.",
      ],
      followUp: {
        question: "What makes a good first automated check?",
        answer:
          "Choose one important rule that rarely changes, with known starting data and a clear result. The delivery cutoff works well if you can reliably prepare a ₹500 cart.",
      },
      takeaway:
        "List three checks you repeat. Pick the one with the clearest expected result and estimate how often it will run.",
      question:
        "Which is a better automation candidate, checking the ₹500 cutoff each release or judging whether a new checkout feels clear?",
      quizAnswer:
        "The ₹500 cutoff has a clear, repeatable expected result. Exploring the clarity of a new checkout benefits from human judgment.",
      reference: "ISTQB syllabus on the benefits and risks of automation",
      url: istqb,
    },
  ],
};
