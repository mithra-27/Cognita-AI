import AssessmentRunner from '../components/AssessmentRunner';
import { api } from '../api/client';

export default function PreAssessment() {
  return (
    <AssessmentRunner
      title="Pre-Assessment"
      badgeLabel="Begin Assessment"
      loadQuestions={async () => {
        const data = await api.startAssessment();
        return data;
      }}
      submitAnswers={async (answers) => api.submitAssessment(answers)}
    />
  );
}
