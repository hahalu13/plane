import { redirect } from "react-router";
// This is a client-side redirect, we can't access the store here
// We'll redirect to the home page which will handle the workspace redirection

export const clientLoader = () => {
  // Redirect to home page with next_path parameter
  // The AuthenticationWrapper will handle finding the user's workspace
  throw redirect(`/?next_path=/test/analytics/user-work-stats`);
};

export default function UserWorkStatsTest() {
  return null;
}
