import AssessmentRunner from '../components/AssessmentRunner';
import { api } from '../api/client';

export default function PostAssessment() {
  return (
    <AssessmentRunner
      title="Post-Assessment"
      badgeLabel="Begin Post-Assessment"
      loadQuestions={async () => {
        const data = await api.startPostAssessment();
        return data;
      }}
      submitAnswers={async (answers) =>
        api.submitPostAssessment(answers)
      }
    />
  );
}
