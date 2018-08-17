import random

import numpy as np
#from skimage.transform import rescale
from PIL import Image, ImageFilter
from neuralmonkey.readers.image_reader import single_image_for_imagenet
from neuralmonkey.experiment import Experiment
from neuralmonkey.dataset.dataset import Dataset

import matplotlib.pyplot as plt

class Model():

    def __init__(self):
        self.exp = Experiment(config_path='../models/captioning_1.ini')
        self.exp.build_model()
        self.input_image_path = ""
        self.caption = []
        self.alphas = []

    def generate_caption(self, rel_path):
        self.input_image_path = rel_path

        img = single_image_for_imagenet(path=rel_path,
                                        target_width=224,
                                        target_height=224,
                                        vgg_normalization=True,
                                        zero_one_normalization=False)
        data = { "images" : [img] }
        dataset = Dataset("test", data, {})
        try:
            _, output = self.exp.run_model(dataset, write_out=False)
            return output["target"][0]
        except RuntimeError as rerr:
            print(rerr)
            print("Have you trained your model?")
            exit(1)

    def get_result(self, rel_path):
        self.caption = self.generate_caption(rel_path)
        self.alphas = get_dummy_alphas(size=len(self.caption))
        return (self.caption, self.alphas)

    def get_result_images(self):
        res = []
        ori = Image.open(self.input_image_path)

        for alp in self.alphas:
            img = Image.fromarray(alp)
            img = rescale_and_smooth(img)
            new = apply_attention_mask(ori, img)
            res.append(new)

        return res

def get_dummy_alphas(height=14, width=14, size=1):
    res = np.zeros((size, height, width), dtype=np.uint8)

    for k in range(size):
        arr = np.zeros((height, width))
        u = random.randint(0, height - 1)
        v = random.randint(0, width - 1)

        for i in range(height):
            for j in range(width):
                arr[i, j] = height**2 + width**2 - (i - u)**2 - (j - v)**2

        max = np.amax(arr)
        arr = arr / max
        res[k] = np.uint8(225 * arr)

    return res

def rescale_and_smooth(pil_image, scale=16, smooth=True):
    w = pil_image.width
    h = pil_image.height
    n_img = pil_image.resize((scale * w, scale * h))
    n_img = n_img.filter(ImageFilter.GaussianBlur(5))
    return n_img

def apply_attention_mask(orig_pil_img, mask_pil_img, alpha_channel=0.8):
    assert (orig_pil_img.height == mask_pil_img.height) and \
        (orig_pil_img.width == mask_pil_img.width)
    assert alpha_channel <= 1.

    mask = mask_pil_img.convert('RGBA')
    alpha = int(255 * alpha_channel)
    mask.putalpha(alpha)

    cp = orig_pil_img.copy()
    cp.paste(mask, (0,0), mask)
    return cp
