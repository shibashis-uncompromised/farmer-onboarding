import { createTheme, type MantineColorsTuple } from "@mantine/core";

const green: MantineColorsTuple = [
  "#e9f8f0", "#d3eee0", "#a6dcc0", "#75c99f", "#4fb985",
  "#36b074", "#27ab6b", "#16965a", "#06854f", "#007342",
];

export const theme = createTheme({
  primaryColor: "green",
  colors: { green },
  primaryShade: { light: 7, dark: 6 },
  defaultRadius: "md",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  headings: { fontWeight: "700" },
  cursorType: "pointer",
});
