// Define the array of exercise SSNs
let exerciseSSNs = []; // e.g. ["00000-26001",...,"00000-26010"]

// User ID and section ID 
let userId = "yourUserId";
let sectionId = "yourSectionId";

// Option mapping
let optionMapping = {
  1: "A",
  2: "B",
  3: "C",
  4: "D",
  5: "E",
  6: "F",
};

// Function to fetch submissions and check correctness
async function fetchSubmissionsAndCheck(exSSNs, userId, sectionId) {
  let submissions = {};

  for (let exSSN of exSSNs) {
    try {
      let data = await $.ajax({
        data: {
          exssn: exSSN,
          userId: userId,
          sectionId: sectionId,
          approvalsOnly: false,
        },
        url: "/codelab/api/submissions",
        contentType: "application/json",
        suppressGlobalErrorHandler: true,
      });

      // Filter and process only correct submissions
      let correctSubmissions = data
        .filter((submission) => submission.isCorrect)
        .map((submission) => {
          return {
            id: submission.id,
            exerciseSSN: submission.exerciseSSN,
            isCorrect: submission.isCorrect,
            submissionText: submission.submissionText,
          };
        });
      submissions[exSSN] = correctSubmissions;
    } catch (error) {
      console.error(`Error fetching submissions for ${exSSN}:`, error);
    }
  }

  return submissions;
}

// Define the callback function to process the XML response
function handleInstructions(xml) {
  let questions = {};
  $(xml)
    .find("Exercise")
    .each(function () {
      let ssn = $(this).attr("SSN");
      let question = $(this)
        .text()
        .replace(/<\s*br[^>]?>/, "")
        .replace(/(<([^>]+)>)/g, "")
        .replace(/\s+/g, " ")
        .trim();
      questions[ssn] = question;
    });

  return questions;
}

// Function to fetch questions using the provided handleInstructions callback
async function fetchQuestions(exSSNs) {
  return new Promise((resolve, reject) => {
    let options = {
      args: { exSSNs: exSSNs },
      callback: function (xml) {
        try {
          let questions = handleInstructions(xml);
          resolve(questions);
        } catch (error) {
          reject(error);
        }
      },
      dataType: "xml",
    };
    TCAPI.getInstructions(options);
  });
}

// Function to clean up submission text and map options
function cleanSubmissionText(text) {
  return text
    .replace(/currentPage=[^:]+::::/g, "")
    .replace(/c(\d)=([^:]+)::::c\1isCorrect=true::::/g, (match, p1, p2) => {
      return optionMapping[p2] ? optionMapping[p2] : p2;
    })
    .replace(/::::/g, "")
    .trim();
}

// Fetch submissions, check correctness, fetch questions, and combine them
async function fetchAndCombine(exSSNs, userId, sectionId) {
  try {
    let submissions = await fetchSubmissionsAndCheck(exSSNs, userId, sectionId);
    let questions = await fetchQuestions(exSSNs);

    let combinedResults = exSSNs.map((exSSN, index) => {
      let correctSubmissions = submissions[exSSN] || [];
      let question = questions[exSSN] || "Question not found";
      return {
        index: index + 1,
        exSSN: exSSN,
        question: question,
        submissions: correctSubmissions,
      };
    });

    // Create and download the markdown file with the combined information
    let mdContent = combinedResults
      .map((result) => {
        return `## Question ${result.index} (${result.exSSN})\n\`\`\`\n${result.question}\n\`\`\`\n## Submissions:\n\`\`\`java\n${result.submissions.map((submission) => cleanSubmissionText(submission.submissionText)).join("\n\n")}\n\`\`\`\n`;
      })
      .join("\n");

    let blob = new Blob([mdContent], { type: "text/markdown;charset=utf-8" });
    let link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "submissions_with_questions.md";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error("Error in fetchAndCombine:", error);
  }
}

// Call the function to fetch and combine data
fetchAndCombine(exerciseSSNs, userId, sectionId);
