-- Enable realtime for scrape_operations table
ALTER PUBLICATION supabase_realtime ADD TABLE scrape_operations;

-- Enable realtime for match_scraped_data table
ALTER PUBLICATION supabase_realtime ADD TABLE match_scraped_data;
