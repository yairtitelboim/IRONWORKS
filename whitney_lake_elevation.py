#!/usr/bin/env python3
"""
Whitney Lake Water Surface Elevation Data Fetcher and Visualizer

This script fetches water surface elevation data for Whitney Lake (WTYT2) 
from the USACE CWMS API and displays a timeline graph for the last 3 years.
"""

import requests
import json
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from datetime import datetime, timedelta
import numpy as np
from typing import Dict, List, Tuple, Optional
import time

class WhitneyLakeDataFetcher:
    """Fetches and visualizes Whitney Lake water surface elevation data."""
    
    def __init__(self):
        self.base_url = "https://cwms-data.usace.army.mil/cwms-data"
        self.office = "SWF"
        self.location_id = "WTYT2"
        self.elevation_series = "WTYT2.Elev.Inst.1Hour.0.Decodes-Rev"
        
    def fetch_elevation_data(self, start_date: str, end_date: str) -> Optional[Dict]:
        """
        Fetch elevation data from the CWMS API.
        
        Args:
            start_date: Start date in format 'YYYY-MM-DD'
            end_date: End date in format 'YYYY-MM-DD'
            
        Returns:
            API response data or None if failed
        """
        url = f"{self.base_url}/timeseries"
        params = {
            'office': self.office,
            'name': self.elevation_series,
            'begin': f"{start_date}T00:00:00Z",
            'end': f"{end_date}T23:59:59Z"
        }
        
        try:
            print(f"Fetching data from {start_date} to {end_date}...")
            response = requests.get(url, params=params, timeout=30)
            response.raise_for_status()
            
            data = response.json()
            print(f"Successfully fetched {len(data.get('values', []))} data points")
            return data
            
        except requests.exceptions.RequestException as e:
            print(f"Error fetching data: {e}")
            return None
        except json.JSONDecodeError as e:
            print(f"Error parsing JSON: {e}")
            return None
    
    def parse_data_points(self, api_data: Dict) -> pd.DataFrame:
        """
        Parse API response into a pandas DataFrame.
        
        Args:
            api_data: Raw API response data
            
        Returns:
            DataFrame with datetime and elevation columns
        """
        if not api_data or 'values' not in api_data:
            return pd.DataFrame()
        
        # Extract values from API response
        values = api_data['values']
        timestamps = []
        elevations = []
        quality_codes = []
        
        for point in values:
            if len(point) >= 3:
                # Convert timestamp from milliseconds to datetime
                timestamp = datetime.fromtimestamp(point[0] / 1000)
                elevation = point[1]
                quality = point[2]
                
                # Only include data with good quality (quality code 0)
                if quality == 0:
                    timestamps.append(timestamp)
                    elevations.append(elevation)
                    quality_codes.append(quality)
        
        # Create DataFrame
        df = pd.DataFrame({
            'datetime': timestamps,
            'elevation_ft': elevations,
            'quality': quality_codes
        })
        
        # Set datetime as index
        df.set_index('datetime', inplace=True)
        
        return df
    
    def fetch_three_years_data(self) -> pd.DataFrame:
        """
        Fetch elevation data for the last 3 years.
        
        Returns:
            Combined DataFrame with all data
        """
        end_date = datetime.now()
        start_date = end_date - timedelta(days=3*365)  # 3 years ago
        
        # Split into yearly chunks to avoid API limits
        all_dataframes = []
        
        for year in range(3):
            year_start = start_date + timedelta(days=year*365)
            year_end = start_date + timedelta(days=(year+1)*365)
            
            if year == 2:  # Last year, go to current date
                year_end = end_date
            
            start_str = year_start.strftime('%Y-%m-%d')
            end_str = year_end.strftime('%Y-%m-%d')
            
            print(f"Fetching year {year + 1}/3: {start_str} to {end_str}")
            
            api_data = self.fetch_elevation_data(start_str, end_str)
            if api_data:
                df = self.parse_data_points(api_data)
                if not df.empty:
                    all_dataframes.append(df)
                    print(f"  Added {len(df)} data points")
                else:
                    print(f"  No data points found for this period")
            else:
                print(f"  Failed to fetch data for this period")
            
            # Small delay to be respectful to the API
            time.sleep(1)
        
        if all_dataframes:
            # Combine all dataframes
            combined_df = pd.concat(all_dataframes, ignore_index=False)
            combined_df = combined_df.sort_index()  # Sort by datetime
            print(f"Total data points: {len(combined_df)}")
            return combined_df
        else:
            print("No data was successfully fetched")
            return pd.DataFrame()
    
    def create_timeline_graph(self, df: pd.DataFrame) -> None:
        """
        Create and display a timeline graph of elevation data.
        
        Args:
            df: DataFrame with elevation data
        """
        if df.empty:
            print("No data to plot")
            return
        
        # Create the plot
        plt.figure(figsize=(15, 8))
        
        # Plot elevation data
        plt.plot(df.index, df['elevation_ft'], linewidth=1, alpha=0.8, color='blue')
        
        # Customize the plot
        plt.title('Whitney Lake Water Surface Elevation - Last 3 Years', 
                 fontsize=16, fontweight='bold')
        plt.xlabel('Date', fontsize=12)
        plt.ylabel('Elevation (feet)', fontsize=12)
        plt.grid(True, alpha=0.3)
        
        # Format x-axis
        plt.gca().xaxis.set_major_formatter(mdates.DateFormatter('%Y-%m'))
        plt.gca().xaxis.set_major_locator(mdates.MonthLocator(interval=3))
        plt.gca().xaxis.set_minor_locator(mdates.MonthLocator())
        plt.xticks(rotation=45)
        
        # Add statistics text
        mean_elev = df['elevation_ft'].mean()
        min_elev = df['elevation_ft'].min()
        max_elev = df['elevation_ft'].max()
        
        stats_text = f'Mean: {mean_elev:.2f} ft\nMin: {min_elev:.2f} ft\nMax: {max_elev:.2f} ft'
        plt.text(0.02, 0.98, stats_text, transform=plt.gca().transAxes, 
                verticalalignment='top', bbox=dict(boxstyle='round', facecolor='wheat', alpha=0.8))
        
        # Add data point count
        plt.text(0.02, 0.88, f'Data Points: {len(df):,}', 
                transform=plt.gca().transAxes, verticalalignment='top',
                bbox=dict(boxstyle='round', facecolor='lightblue', alpha=0.8))
        
        # Tight layout and show
        plt.tight_layout()
        plt.show()
        
        # Print summary statistics
        print(f"\n=== Whitney Lake Elevation Summary (Last 3 Years) ===")
        print(f"Data Points: {len(df):,}")
        print(f"Date Range: {df.index.min().strftime('%Y-%m-%d')} to {df.index.max().strftime('%Y-%m-%d')}")
        print(f"Mean Elevation: {mean_elev:.2f} ft")
        print(f"Minimum Elevation: {min_elev:.2f} ft")
        print(f"Maximum Elevation: {max_elev:.2f} ft")
        print(f"Elevation Range: {max_elev - min_elev:.2f} ft")
    
    def run(self) -> None:
        """Main method to fetch data and create visualization."""
        print("=== Whitney Lake Water Surface Elevation Data Fetcher ===")
        print(f"Location: {self.location_id} (Whitney Lake)")
        print(f"Office: {self.office}")
        print(f"Series: {self.elevation_series}")
        print()
        
        # Fetch data for the last 3 years
        df = self.fetch_three_years_data()
        
        if not df.empty:
            # Create timeline graph
            self.create_timeline_graph(df)
        else:
            print("No data available to display")

def main():
    """Main function to run the Whitney Lake data fetcher."""
    try:
        fetcher = WhitneyLakeDataFetcher()
        fetcher.run()
    except KeyboardInterrupt:
        print("\nOperation cancelled by user")
    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    main()
