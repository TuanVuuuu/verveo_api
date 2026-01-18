import { readFileSync } from 'fs';
import { AIService } from './src/services/aiService.js';
import { DateTime } from './src/utils/datetime.js';

interface TestCase {
  input: string;
  expectedTitle: string;
  expectedDate: string;
  categories?: string[];
  note?: string;
}

interface TestSuite {
  currentTime: string;
  testCases: TestCase[];
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const ms = String(date.getMilliseconds()).padStart(3, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${ms}`;
}

function parseDate(dateStr: string): Date {
  return new Date(dateStr);
}

function compareDates(actual: Date, expected: Date, toleranceMinutes = 5): boolean {
  const diffMs = Math.abs(actual.getTime() - expected.getTime());
  const diffMinutes = diffMs / (1000 * 60);
  return diffMinutes <= toleranceMinutes;
}

async function runTestCases() {
  console.log('🧪 Running Test Cases from test-cases.json');
  console.log('==========================================\n');

  // Load test cases
  const testSuite: TestSuite = JSON.parse(
    readFileSync('./test-cases.json', 'utf-8')
  );

  const currentTime = parseDate(testSuite.currentTime);
  console.log(`⏰ Current Time: ${formatDate(currentTime)}\n`);

  const aiService = new AIService();
  let passed = 0;
  let failed = 0;
  const failures: Array<{
    input: string;
    expected: string;
    actual: string;
    reason: string;
  }> = [];

  for (let i = 0; i < testSuite.testCases.length; i++) {
    const testCase = testSuite.testCases[i];
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📝 Test ${i + 1}/${testSuite.testCases.length}`);
    console.log(`   Input: "${testCase.input}"`);
    if (testCase.note) {
      console.log(`   📌 Note: ${testCase.note}`);
    }

    try {
      // Call AI service with test currentTime
      const result = await aiService.generateTodoWithDeepseek(testCase.input, currentTime);

      const actualStartTime = parseDate(result.startTime);
      const expectedStartTime = parseDate(testCase.expectedDate);

      // Debug: Get intent to see timeHint
      const intent = await aiService.generateTodoIntent(testCase.input);
      if (intent.timeHint) {
        console.log(`   🔍 TimeHint: "${intent.timeHint}"`);
      } else {
        console.log(`   ⚠️  TimeHint: EMPTY!`);
      }

      console.log(`   📅 Expected: ${formatDate(expectedStartTime)}`);
      console.log(`   📅 Actual:   ${formatDate(actualStartTime)}`);
      console.log(`   📝 Title:    ${result.title}`);

      // Check title (fuzzy match)
      const titleMatch = result.title.toLowerCase().includes(testCase.expectedTitle.toLowerCase()) ||
                        testCase.expectedTitle.toLowerCase().includes(result.title.toLowerCase());
      
      // Check date (with 5 minutes tolerance)
      const dateMatch = compareDates(actualStartTime, expectedStartTime, 5);

      if (titleMatch && dateMatch) {
        passed++;
        console.log(`   ✅ PASS`);
      } else {
        failed++;
        let reason = '';
        if (!titleMatch) reason += 'Title mismatch. ';
        if (!dateMatch) {
          const diffMinutes = Math.abs(actualStartTime.getTime() - expectedStartTime.getTime()) / (1000 * 60);
          reason += `Date mismatch (diff: ${diffMinutes.toFixed(1)} minutes). `;
        }
        console.log(`   ❌ FAIL: ${reason}`);
        failures.push({
          input: testCase.input,
          expected: formatDate(expectedStartTime),
          actual: formatDate(actualStartTime),
          reason: reason.trim()
        });
      }
    } catch (error) {
      failed++;
      console.error(`   ❌ ERROR:`, error);
      failures.push({
        input: testCase.input,
        expected: testCase.expectedDate,
        actual: 'ERROR',
        reason: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log(`\n\n📊 Test Results:`);
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   📈 Total: ${testSuite.testCases.length}`);
  console.log(`   📊 Success rate: ${((passed / testSuite.testCases.length) * 100).toFixed(1)}%`);

  if (failures.length > 0) {
    console.log(`\n\n❌ Failed Tests:`);
    failures.forEach((failure, idx) => {
      console.log(`\n   ${idx + 1}. Input: "${failure.input}"`);
      console.log(`      Expected: ${failure.expected}`);
      console.log(`      Actual:   ${failure.actual}`);
      console.log(`      Reason:   ${failure.reason}`);
    });
  }
}

runTestCases().catch(console.error);

