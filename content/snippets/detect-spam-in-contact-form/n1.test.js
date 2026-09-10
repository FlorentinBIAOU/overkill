import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fold, isSpam, spamScore, train } from './n1.js';

// A small labelled set, the kind an afternoon spent in the inbox produces.
const SPAM = [
  'Hello, we offer guaranteed first page ranking on Google for your website.',
  'Boost your traffic with our premium backlink packages at cheap prices.',
  'Dear sir, I can improve your website ranking within one month, low cost.',
  'Earn passive income trading crypto, join our telegram channel right now.',
  'We provide guest posting services on high authority blogs, best rates.',
  'Buy cheap followers and likes for your social media accounts today.',
  'Your website design looks outdated, we redesign it for a very low price.',
  'Congratulations, you have won a prize, click the link below to claim it.',
  'We are an offshore web development company, hire our developers cheap.',
  'Increase your sales with our bulk email marketing database of contacts.',
  'Dear owner, your domain is expiring, renew it today at a discount price.',
  'We sell verified leads for your industry, guaranteed results, free trial.',
  'Hello dear, I have a business proposal worth millions, reply for details.',
  'Get thousands of visitors to your website every month, no effort needed.',
  'Our agency offers unlimited traffic and top rankings, first month free.',
  'Special offer this week only, cheap logo design and unlimited revisions.',
];

const GENUINE = [
  'Hello, I ordered a lamp last week and it arrived damaged, what should I do?',
  'Could you tell me if the workshop on tuesday is still open for registration?',
  'I would like a quote for repainting the shutters of a house near Nantes.',
  'Your online form refused my postcode, I live abroad, can you help me?',
  'Good morning, is the shop open on saturday afternoon during august?',
  'I sent an invoice three weeks ago and it is still unpaid, who do I contact?',
  'Do you deliver to Belgium, and how long does the delivery usually take?',
  'The instructions in the manual mention a part that was not in the box.',
  'I lost the receipt for a purchase made in june, can you send a copy?',
  'Hello, my order number 4512 has not moved for ten days, is it lost?',
  'Is the blue model still available in size medium, or is it discontinued?',
  'We are a school and would like to visit your workshop with fifteen pupils.',
  'The battery of the device I bought in march no longer holds a charge.',
  'Can I change the delivery address of an order that was placed yesterday?',
  'Hello, I would like to cancel my subscription before the next renewal.',
  'Your newsletter arrives twice, could you remove the duplicate address?',
];

const model = train(
  [...SPAM, ...GENUINE],
  [...SPAM.map(() => 1), ...GENUINE.map(() => 0)],
);

test('folding removes case and accents', () => {
  assert.equal(fold('Commande Cassée'), 'commande cassee');
});

test('catches a solicitation it has never seen', () => {
  assert.ok(isSpam(model, 'Hi, we can boost your google ranking with quality links, cheap offer.'));
});

test('leaves a new customer enquiry alone', () => {
  assert.ok(!isSpam(model, 'Hello, my parcel arrived yesterday but the box was open.'));
});

test('catches the spellings that walk past a word list', () => {
  // Character n-grams see the shape of a word, not its exact letters.
  for (const written of [
    'we sell b a c k l i n k s and cheap traffic, boost your rankings today',
    'we sell backl1nks and cheap seo packages, boost your ranking now',
  ]) {
    assert.ok(isSpam(model, written), written);
  }
});

test('survives accents and a very long message', () => {
  assert.ok(!isSpam(model, 'Bonjour, ma commande est arrivée cassée, que dois-je faire ?'));
  const repeated = 'Hello, I ordered a lamp last week and it arrived damaged. '.repeat(20);
  assert.ok(!isSpam(model, repeated));
});

test('the threshold is yours to set', () => {
  // A threshold of zero rejects everything, which is the point of exposing it.
  assert.ok(isSpam(model, 'Hello, my parcel arrived yesterday but the box was open.', 0));
});

test('the score is a probability', () => {
  const score = spamScore(model, 'anything at all');
  assert.ok(score >= 0 && score <= 1);
});

test('breaking point: a solicitation written in the register of a customer', () => {
  // This rung learns the register of the messages it was shown. A sender who
  // writes like a customer, short, polite, no offer, no price, no link,
  // scores like a customer. It is the same message that walks past N0, and it
  // walks past N1 too: the difference between the two rungs is the flood in
  // between, not this sender.
  const patientBot =
    'Good morning, I came across your company and I would like to discuss ' +
    'a partnership to increase your visibility. When would suit you?';
  assert.ok(spamScore(model, patientBot) < 0.5);
  assert.ok(!isSpam(model, patientBot));
});
