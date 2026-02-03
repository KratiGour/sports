from sqlalchemy import Column, Integer, Float
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()


class PlayerStats(Base):
    """
    Stores aggregated cricket statistics for a player.

    Phase-1:
    - Basic batting statistics

    Phase-2 (Planned):
    - Bowling statistics
    - Fielding statistics
    - Format-wise stats (T20, ODI, Test)
    - Season-wise stats
    """

    __tablename__ = "player_stats"

    id = Column(Integer, primary_key=True, index=True)

    # Reference to player table
    player_id = Column(Integer, nullable=False)

    # Batting stats
    matches = Column(Integer, default=0)
    runs = Column(Integer, default=0)
    strike_rate = Column(Float, default=0.0)

    # TODO:
    # balls_faced
    # average
    # highest_score
    # bowling_stats (wickets, economy)
    # fielding_stats (catches, run_outs)