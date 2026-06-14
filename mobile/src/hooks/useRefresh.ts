import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

/** Pull-to-refresh: invalidates all weather queries and waits for refetch. */
export function useRefresh() {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await queryClient.invalidateQueries();
    } finally {
      setRefreshing(false);
    }
  }, [queryClient]);

  return { refreshing, onRefresh };
}
