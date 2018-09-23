from typing import Dict, List, Set, cast

import numpy as np
from typeguard import check_argument_types

from neuralmonkey.decoders.beam_search_decoder import BeamSearchDecoder
from neuralmonkey.model.model_part import ModelPart
from neuralmonkey.attention.base_attention import BaseAttention
from neuralmonkey.runners.base_runner import (
    BaseRunner, Executable, FeedDict, ExecutionResult, NextExecute)

import pdb
from neuralmonkey.beamsearch_output_graph import BeamSearchOutputGraph

class BeamSearchWordAlignmentExecutable(Executable):
    def __init__(self,
                 all_coders: Set[ModelPart],
                 decoder: BeamSearchDecoder) -> None:
        self._all_coders = all_coders
        self._decoder = decoder

        self._step = 0
        self._next_feed = [{}]

        self.result = None

    def next_to_execute(self) -> NextExecute:
        return (self._all_coders,
                {"bswa_outputs": self._decoder.outputs},
                self._next_feed)

    def collect_results(self, results: List[Dict]) -> None:
        out = results[0]["bswa_outputs"]

        step_size = out.last_dec_loop_state.step - 1
        batch_size = out.last_search_step_output.scores.shape[1]
        if self._step == 0:
            self._scores = np.empty(
                [0, batch_size, self._decoder.beam_size],
                dtype=float)
            self._parent_ids = np.empty(
                [0, batch_size, self._decoder.beam_size],
                dtype=int)
            self._token_ids = np.empty(
                [0, batch_size, self._decoder.beam_size],
                dtype=int)
        self._step += step_size
        self._scores = np.append(
            self._scores,
            out.last_search_step_output.scores[0:step_size],
            axis=0)

        self._parent_ids = np.append(
            self._parent_ids,
            out.last_search_step_output.parent_ids[0:step_size],
            axis=0)

        self._token_ids = np.append(
            self._token_ids,
            out.last_search_step_output.token_ids[0:step_size],
            axis=0)

        self._attention_loop_states = out.attention_loop_states[0]
        self._prepare_results()
        return

    def _prepare_results(self):
        max_time = self._step
        batch_size = self._scores.shape[1] # shape(_scores) = (time, batch, beam)

        # Decode token_ids into words from the vocabulary.
        decoded_tokens = [] # (batch, time, beam)
        for b in range(batch_size):
            batch = []
            for t in range(max_time):
                tok_dec = [self._decoder.vocabulary.index_to_word[tok]
                    for tok in self._token_ids[t][b]]
                batch.append(tok_dec)
            decoded_tokens.append(batch)

        # Prepare attention alignments.

        # First weight tensor is an abundance from the initial decoder call.
        # ^--- Overit
        att = self._attention_loop_states["weights"][1:]
        # TODO: Check that the reshaping doesn't mess up the order
        att = att.reshape((batch_size, max_time, self._decoder.beam_size, -1))

        self._scores = np.transpose(self._scores, axes=(1, 0, 2))
        self._parent_ids = np.transpose(self._parent_ids, axes=(1, 0, 2))

        result = []
        for i in range(batch_size):
            bs_graph = BeamSearchOutputGraph(self._scores[i],
                                             decoded_tokens[i],
                                             self._parent_ids[i],
                                             att[i],
                                             self._decoder.beam_size,
                                             max_time)
            result.append(bs_graph)

        self.result = ExecutionResult(
            outputs=result,
            losses=[],
            scalar_summaries=None,
            histogram_summaries=None,
            image_summaries=None)
        return

class BeamSearchWordAlignmentRunner(BaseRunner):
    def __init__(self,
                 output_series: str,
                 decoder: BeamSearchDecoder,
                 attention: BaseAttention) -> None:
        check_argument_types()
        BaseRunner.__init__(self, output_series, decoder)

    def get_executable(self,
                       compute_losses: bool = False,
                       summaries: bool = True,
                       num_sessions: int = 1) -> BeamSearchWordAlignmentExecutable:
        decoder = cast(BeamSearchDecoder, self._decoder)

        return BeamSearchWordAlignmentExecutable(self.all_coders, decoder)

    @property
    def loss_names(self) -> List[str]:
        return []
