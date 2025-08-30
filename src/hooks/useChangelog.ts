import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

export const useChangelog = () => {
  const changelog = useQuery(api.changelog.list) || [];
  const createChangelog = useMutation(api.changelog.create);

  const addChangelogEntry = async (changelogData: {
    version: string;
    english_content: {
      features?: string[];
      bugfixes?: string[];
      improvements?: string[];
    };
    spanish_content: {
      features?: string[];
      bugfixes?: string[];
      improvements?: string[];
    };
    release_notes_en?: string;
    release_notes_es?: string;
  }) => {
    try {
      const changelogId = await createChangelog(changelogData);
      return changelogId;
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to create changelog entry');
    }
  };

  return {
    changelog,
    loading: changelog === undefined,
    error: null, // Convex handles errors differently
    addChangelogEntry,
    refetch: () => {}, // Convex handles real-time updates automatically
  };
};