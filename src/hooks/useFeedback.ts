import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

export const useFeedback = () => {
  const feedback = useQuery(api.feedback.list) || [];
  const createFeedback = useMutation(api.feedback.create);
  const updateStatus = useMutation(api.feedback.updateStatus);
  const markCompletedAsReleased = useMutation(api.feedback.markCompletedAsReleased);

  const submitFeedback = async (feedbackData: {
    category: "suggestion" | "bug" | "change_request";
    subject: string;
    description: string;
    priority: "low" | "medium" | "high";
  }) => {
    try {
      const feedbackId = await createFeedback(feedbackData);
      return { _id: feedbackId, ...feedbackData, status: "new" as const };
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to submit feedback');
    }
  };

  const updateFeedbackStatus = async (
    id: Id<"feedback">,
    status: "new" | "in_progress" | "completed" | "released",
    developer_notes?: string
  ) => {
    try {
      await updateStatus({ id, status, developer_notes });
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to update feedback status');
    }
  };

  const releaseCompletedFeedback = async () => {
    try {
      const count = await markCompletedAsReleased();
      return count;
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to release completed feedback');
    }
  };

  return {
    feedback,
    loading: feedback === undefined,
    error: null, // Convex handles errors differently
    submitFeedback,
    updateFeedbackStatus,
    releaseCompletedFeedback,
    refetch: () => {}, // Convex handles real-time updates automatically
  };
};