import pdb

from json import JSONEncoder
from neuralmonkey.vocabulary import END_TOKEN, PAD_TOKEN

class BeamSearchOutputGraphNode():
    def __init__(self, score, token, alignment, children = None):
        self._score = score
        self._token = token
        self._alignment = alignment

        if children is None:
            self._children = []
        else:
            self._children = children

    @property
    def score(self):
        return self._score

    @property
    def token(self):
        return self._token

    @property
    def alignment(self):
        return self._alignment

    @property
    def children(self):
        return self._children

    def collect_all_hypotheses(self):
        if self._token == END_TOKEN:
            return ([[]], [[]], [[]])

        elif self._children == []:
            return ([[self._token]], [[self._score]], [[self._alignment]])

        token_h = []
        score_h = []
        alignment_h = []

        for c in self._children:
            t, s, a = c.collect_all_hypotheses()
            token_h.extend(t)
            score_h.extend(s)
            alignment_h.extend(a)

        for t, s, a in zip(token_h, score_h, alignment_h):
            t.append(self._token)
            s.append(self._score)
            a.append(self._alignment)

        return (token_h, score_h, alignment_h)

    def collect_hypotheses(self, prefix):
        if self._token == END_TOKEN:
            return [prefix]
        elif self._children == []:
            return None

        res = []
        t, s, a = prefix
        t.append(self._token)
        s.append(self._score)
        a.append(self._alignment)

        for c in self._children:
            tup = c.collect_hypotheses((t[:], s[:], a[:]))
            if tup is not None:
                res.extend(tup)
        return res

class BeamSearchOutputGraph():
    def __init__(self,
                 scores,
                 tokens,
                 parent_ids,
                 alignments,
                 beam_size,
                 max_time):
        self._root = BeamSearchOutputGraphNode(0, "START", None)
        self._beam_size = beam_size

        opened_hyp = [None] * beam_size
        opened_hyp[0] = self._root

        for t in range(max_time):
            future_opened_hyp = [None] * beam_size
            for b in range(beam_size):
                if tokens[t][b] != PAD_TOKEN: # Stop building the hypotheses on <pad> token encounter
                    node = BeamSearchOutputGraphNode(score=scores[t,b].item(),
                                                    token=tokens[t][b],
                                                    alignment=alignments[t,b])
                    opened_hyp[parent_ids[t,b]].children.append(node)
                    future_opened_hyp[b] = node
            opened_hyp = future_opened_hyp

    @property
    def root(self):
        return self._root

    @property
    def beam_size(self):
        return self._beam_size

    def collect_all_hypotheses(self):
        """Traverses the graph, collecting all hypotheses; finished
        and unfinished.
        """

        th = []
        sh = []
        ah = []

        for c in self._root.children:
            t, s, a = c.collect_all_hypotheses()
            th.extend(t)
            sh.extend(s)
            ah.extend(a)

        for t, s, a in zip(th, sh, ah):
            t.reverse()
            s.reverse()
            a.reverse()

        hyps = list(zip(th, sh, ah))
        hyps = list(zip(*hyps))

        return {'tokens': hyps[0], 'scores': hyps[1], 'alignments': hyps[2]}


    def collect_hypotheses(self):
        """Traverses the graph, collecting the finished hypotheses.
        Returns them ordered ascending by overall negative log probability.
        """

        hyps = []

        for c in self._root.children:
            hs = c.collect_hypotheses(([], [], []))
            if hs is not None:
                hyps.extend(hs)

        hyps.sort(key=lambda t: t[1][-1]) # sort according to the last score
        hyps = list(zip(*hyps))

        return {'tokens': hyps[0], 'scores': hyps[1], 'alignments': hyps[2]}


class BeamSearchOutputGraphEncoder(JSONEncoder):
    def default(self, graph):
        return self._encode_node(graph.root)

    def _encode_node(self, node):
        enc_children = []
        if node.children != []:
            for c in node.children:
                enc_children.append(self._encode_node(c))

        if node.alignment is None:
            alig = []
        else:
            alig = node.alignment.tolist()

        return {'token': node.token,
                'score': node.score,
                'alignment': alig,
                'children': enc_children}
